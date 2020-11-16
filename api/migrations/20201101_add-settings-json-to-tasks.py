# Copyright (c) Facebook, Inc. and its affiliates.

"""
Add api_token to users
"""

from yoyo import step


__depends__ = {}

steps = [
    step(
        "ALTER TABLE tasks ADD settings_json TEXT",
        "ALTER TABLE tasks DROP settings_json",
    )
]