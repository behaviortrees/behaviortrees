cmake_minimum_required(VERSION 3.16)
project(btcpp_check CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

option(BTCPP_V3 "Build against BehaviorTree.CPP 3.8 (ROS 2 Humble)" OFF)

add_executable(btcpp_check check.cpp)

if(BTCPP_V3)
  find_package(behaviortree_cpp_v3 REQUIRED)
  target_compile_definitions(btcpp_check PRIVATE BTCPP_V3)
  # Humble's package config only defines its target through ament extras,
  # which need ament_cmake (absent from ros-core); use its install paths
  set(BTCPP_V3_PREFIX "${behaviortree_cpp_v3_DIR}/../../..")
  find_library(BTCPP_V3_LIBRARY behaviortree_cpp_v3 HINTS "${BTCPP_V3_PREFIX}/lib" REQUIRED)
  target_include_directories(btcpp_check PRIVATE "${BTCPP_V3_PREFIX}/include")
  target_link_libraries(btcpp_check ${BTCPP_V3_LIBRARY})
else()
  find_package(behaviortree_cpp REQUIRED)
  target_link_libraries(btcpp_check behaviortree_cpp::behaviortree_cpp)
endif()
