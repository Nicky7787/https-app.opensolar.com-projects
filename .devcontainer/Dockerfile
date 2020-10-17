#-------------------------------------------------------------------------------------------------------------
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See https://go.microsoft.com/fwlink/?linkid=2090316 for license information.
#-------------------------------------------------------------------------------------------------------------

FROM node:10

# The node image comes with a base non-root 'node' user which this Dockerfile
# gives sudo access. However, for Linux, this user's GID/UID must match your local
# user UID/GID to avoid permission issues with bind mounts. Update USER_UID / USER_GID
# if yours is not 1000. See https://aka.ms/vscode-remote/containers/non-root-user.
ARG USER_UID=1000
ARG USER_GID=$USER_UID

ENV LANGUAGE=en_US.UTF-8 \
	LANG=en_US.UTF-8 \
	# Avoid warnings by switching to noninteractive
	DEBIAN_FRONTEND=noninteractive \
	# Set dbus address we will use
	DBUS_SESSION_BUS_ADDRESS="unix:abstract=/tmp/dbus-session" \
	# Default display to 0 on the host
	DISPLAY=host.docker.internal:0

# Configure apt and install packages
RUN apt-get update \
    && apt-get -y install --no-install-recommends locales locales-all apt-utils dialog 2>&1 \
    #
    # Verify git and needed tools are installed
    && apt-get -y install git iproute2 procps zsh \
    #
    # Install X11 and basic apps for X11 forwarding testing (e.g. xeyes)
    && apt-get install -y x11-apps dbus gnome-keyring fonts-wqy-microhei fonts-droid-fallback \
	&& mkdir -p /var/run/dbus \
    #
    # Install VS Code native dependencies
    && apt-get install -y libnotify4 libnss3 gnupg libsecret-1-dev libgtk-3-0 libxss1 libasound2 libxkbfile-dev \
    #
    # Remove outdated yarn from /opt and install via package
    # so it can be easily updated via apt-get upgrade yarn
    && rm -rf /opt/yarn-* \
    && rm -f /usr/local/bin/yarn \
    && rm -f /usr/local/bin/yarnpkg \
    && apt-get install -y curl apt-transport-https lsb-release \
    && curl -sS https://dl.yarnpkg.com/$(lsb_release -is | tr '[:upper:]' '[:lower:]')/pubkey.gpg | apt-key add - 2>/dev/null \
    && echo "deb https://dl.yarnpkg.com/$(lsb_release -is | tr '[:upper:]' '[:lower:]')/ stable main" | tee /etc/apt/sources.list.d/yarn.list \
    && apt-get update \
    && apt-get -y install --no-install-recommends yarn \
    #
    # Install tslint and typescript globally
    && npm install -g tslint typescript \
    #
    # [Optional] Update a non-root user to match UID/GID - see https://aka.ms/vscode-remote/containers/non-root-user.
    && if [ "$USER_GID" != "1000" ]; then groupmod node --gid $USER_GID; fi \
    && if [ "$USER_UID" != "1000" ]; then usermod --uid $USER_UID node; fi \
    # [Optional] Add add sudo support for non-root user
    && apt-get install -y sudo \
    && echo node ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node \
    #
    # Clean up
    && apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Default to non-root user
USER node

# Go back to the default apt frontend
ENV DEBIAN_FRONTEND=

# Start dbus on boot
CMD ["/bin/bash", "-c", "sudo dbus-daemon --system; dbus-daemon --session --address=unix:abstract=/tmp/dbus-session; sleep infinity"]
