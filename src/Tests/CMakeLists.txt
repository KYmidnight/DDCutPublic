set(TARGET_NAME Tests)

file(GLOB SOURCE_CODE
    "*.cpp"
)

add_executable(${TARGET_NAME} ${SOURCE_CODE})
target_link_libraries(${TARGET_NAME} DDCutDaemon Catch2::Catch2)
