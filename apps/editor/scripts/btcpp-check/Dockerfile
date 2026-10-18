# BehaviorTree.CPP from a ROS 2 distro's own packages, so the check uses the
# exact library Nav2 runs: Jazzy ships v4, Humble ships v3.8.
ARG DISTRO=jazzy
FROM ros:${DISTRO}-ros-core

ARG DISTRO
ARG BT_PACKAGE=behaviortree-cpp
ARG BTCPP_V3=OFF

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential cmake python3 "ros-${DISTRO}-${BT_PACKAGE}" \
  && rm -rf /var/lib/apt/lists/*

COPY CMakeLists.txt check.cpp check.py /src/
RUN . "/opt/ros/${DISTRO}/setup.sh" \
  && cmake -S /src -B /build -DBTCPP_V3=${BTCPP_V3} -DCMAKE_BUILD_TYPE=Release \
  && cmake --build /build

ENV DISTRO=${DISTRO}
ENTRYPOINT ["/bin/bash", "-c", ". /opt/ros/${DISTRO}/setup.sh && exec python3 /src/check.py \"$@\"", "--"]
