#!/bin/sh
# Copyright (C) 2024 Intel Corporation
# SPDX-License-Identifier: Apache-2.0

# Generate a random UUID for the application
export APP_UUID=$(uuidgen)

# Print the generated UUID for verification
echo "Generated UUID: $APP_UUID"

for i in $(env | grep APP_) #// Make sure to use the prefix MY_APP_ if you have any other prefix in env.production file variable name replace it with MY_APP_
do
    key=$(echo $i | cut -d '=' -f 1)
    value=$(echo $i | cut -d '=' -f 2-)
    echo $key=$value
    # sed All files
    # find /usr/share/nginx/html -type f -exec sed -i "s|${key}|${value}|g" '{}' +

    # sed JS, CSS, and HTML files
    find /usr/share/nginx/html -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \) -exec sed -i "s|${key}|${value}|g" '{}' +
done
