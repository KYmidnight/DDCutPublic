#pragma once

#include "Common/CommonHeaders.h"
#include <Common/Logger.h>
using namespace DDLogger;

class FeedRate {
public:
	using Ptr = std::shared_ptr<FeedRate>;

	void SetSlider(const int slider) noexcept
	{
		std::lock_guard<std::mutex> write(m_mutex);

		const int value = std::max(30, slider);
		if (m_slider != value)
		{
			DD_LOG_F("Updating slider to %d", value);

			m_updateRequired = true;
			m_slider = value;
		}
	}

	int GetSlider() const noexcept
	{
		std::lock_guard<std::mutex> read(m_mutex);

		return m_slider;
	}

	int UpdateFeedRate(const int feedRate) noexcept
	{
		std::lock_guard<std::mutex> lock(m_mutex);

		const int calculatedFeedRate = ((feedRate * m_slider) / 100);
		DD_LOG_F("Updating feedrate. Input: %d. Slider: %d. Output: %d", feedRate, m_slider, calculatedFeedRate);
		m_feedRate = feedRate;
		m_updateRequired = false;
		DD_LOG("Feedrate updated.");
		DDLogger::Flush();

		return calculatedFeedRate;
	}

	bool IsUpdateRequired() const noexcept
	{
		std::lock_guard<std::mutex> read(m_mutex);

		return m_updateRequired;
	}

	int GetFeedRate() noexcept
	{
		std::lock_guard<std::mutex> write(m_mutex);

		m_updateRequired = false;

		return ((m_feedRate * m_slider) / 100);
	}

private:
	mutable std::mutex m_mutex;

	bool m_updateRequired{ false };
	int m_slider{ 100 };
	int m_feedRate{ 100 };
};