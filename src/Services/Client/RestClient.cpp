#include "RestClient.h"
#include <Common/Logger.h>
using namespace DDLogger;

static const std::string SERVER = "";
static const std::string AUTH_KEY{ DDCUT_AUTH_KEY };

RestClient::RestClient(asio::ssl::stream<asio::ip::tcp::socket>& socket, asio::streambuf& request, asio::streambuf& response)
	: m_socket(socket), m_request(request), m_response(response)
{

}

RestClient::Response RestClient::Get(const std::string& path)
{
	DD_LOG("Calling: " + path);

	asio::io_context ioContext;
	asio::ssl::context ctx(asio::ssl::context::sslv23);
	ctx.set_default_verify_paths();
	asio::ssl::stream<asio::ip::tcp::socket> socket(ioContext, ctx);

	asio::streambuf request;
	asio::streambuf response;

	// Form the request. We specify the "Connection: close" header so that the
	// server will close the socket after transmitting the response. This will
	// allow us to treat all data up until the EOF as the content.
	std::ostream requestStream(&request);
	requestStream << "GET " << path << " HTTP/1.1\r\n";
	requestStream << "Host: " << SERVER << "\r\n";
	requestStream << "Accept: application/json\r\n";
	requestStream << "Authorization:Basic " << AUTH_KEY << "\r\n";
	requestStream << "Content-Type: application/json\r\n";
	requestStream << "Content-Length: 0\r\n";
	requestStream << "Connection: close\r\n\r\n\r\n";

	// Modern Boost.Asio: resolve directly without query object
	asio::ip::tcp::resolver resolver(ioContext);
	auto res = resolver.resolve(SERVER, "https");

	RestClient client(socket, request, response);

	return client.Resolve(res);
}

RestClient::Response RestClient::Post(const std::string& path, const std::string& jsonBody)
{
	asio::io_context ioContext;
	asio::ssl::context ctx(asio::ssl::context::sslv23);
	ctx.set_default_verify_paths();
	asio::ssl::stream<asio::ip::tcp::socket> socket(ioContext, ctx);

	asio::streambuf request;
	asio::streambuf response;

	// Form the request. We specify the "Connection: close" header so that the
	// server will close the socket after transmitting the response. This will
	// allow us to treat all data up until the EOF as the content.
	std::ostream requestStream(&request);
	requestStream << "POST " << path << " HTTP/1.1\r\n";
	requestStream << "Host: " << SERVER << "\r\n";
	requestStream << "Accept: application/json\r\n";
	requestStream << "Authorization:Basic " << AUTH_KEY << "\r\n";
	requestStream << "Content-Type: application/json\r\n";
	requestStream << "Content-Length: " << jsonBody.size() << "\r\n";
	requestStream << "Connection: close\r\n\r\n";
	requestStream << jsonBody << "\r\n";

	// Modern Boost.Asio: resolve directly without query object
	asio::ip::tcp::resolver resolver(ioContext);
	auto res = resolver.resolve(SERVER, "https");

	RestClient client(socket, request, response);

	return client.Resolve(res);
}

RestClient::Response RestClient::Resolve(asio::ip::tcp::resolver::results_type endpoints)
{
	std::cout << "Resolve OK" << "\n";
	m_socket.set_verify_mode(asio::ssl::verify_none);

	auto err = boost::system::error_code{};
	asio::connect(m_socket.lowest_layer(), endpoints, err);

	if (err) {
		return RestClient::Response{ 0, err.message(), "" };
	}

	return Connect();
}

RestClient::Response RestClient::Connect()
{
	std::cout << "Connect OK " << "\n";
	auto err = boost::system::error_code{};
	m_socket.handshake(asio::ssl::stream_base::client, err);

	if (err) {
		return RestClient::Response{ 0, err.message(), "" };
	}

	return Handshake();
}

RestClient::Response RestClient::Handshake()
{
	std::cout << "Handshake OK " << "\n";
	std::cout << "Request: " << "\n";
	const char* header = static_cast<const char*>(m_request.data().data());
	std::cout << header << "\n";

	// The handshake was successful. Send the request.
	auto err = boost::system::error_code{};
	asio::write(m_socket, m_request, err);

	if (err) {
		return RestClient::Response{ 0, err.message(), "" };
	}

	return WriteRequest();
}

RestClient::Response RestClient::WriteRequest()
{
	// Read the response status line. The m_response streambuf will
	// automatically grow to accommodate the entire line. The growth may be
	// limited by passing a maximum size to the streambuf constructor.
	auto err = boost::system::error_code{};
	asio::read(m_socket, m_response, err);
	//auto read = asio::read_until(m_socket, m_response, "\r\n", err);

	if (err && err.value() != 335544539 && err.value() != 1) {
		return RestClient::Response{ 0, err.message(), "" };
	}

	return ReadStatusLine();
}

RestClient::Response RestClient::ReadStatusLine()
{
	std::cout << "Response: " << "\n";
	const char* resp = static_cast<const char*>(m_response.data().data());
	std::cout << resp << "\n";

	// Check that response is OK.
	std::istream responseStream(&m_response);

	std::string httpVersion;
	responseStream >> httpVersion;

	unsigned int statusCode;
	responseStream >> statusCode;

	std::string statusMessage;
	std::getline(responseStream, statusMessage);

	if (!responseStream || httpVersion.substr(0, 5) != "HTTP/")
	{
		return RestClient::Response{ 0, "Invalid Response", "" };
	}

	asio::read_until(m_socket, m_response, "\r\n\r\n");

	// Process the response headers.
	std::istream m_responsestream(&m_response);
	std::string header;
	while (std::getline(m_responsestream, header) && header != "\r")
	{
		std::cout << header << "\n";
	}
	std::cout << "\n";

	// Write whatever content we already have to output.
	std::stringstream body;
	body << &m_response;
	return RestClient::Response{ statusCode, statusMessage, body.str() };
}
