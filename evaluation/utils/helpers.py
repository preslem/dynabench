# Copyright (c) Facebook, Inc. and its affiliates.

import json
import os
import time
from datetime import datetime, timedelta

import boto3


def send_eval_request(model_id, dataset_name, config, logger=None):
    """
    If dataset name is a perturbed dataset with prefix, will evaluate this
    perturbed dataset only;
    else if dataset name is a base dataset name without prefix, will try to
    evaluate itself plus any perturbed dataset available to generate delta metrics
    """
    try:
        assert (
            model_id == "*" or isinstance(model_id, int) or isinstance(model_id, list)
        ), f"model_id can either be an integer, a list of integers, or *"
        assert (
            dataset_name == "*"
            or isinstance(dataset_name, str)
            or isinstance(dataset_name, list)
        ), f"dataset_name can either be a string, a list of strings, or *"
    except AssertionError as ex:
        if logger:
            logger.error(ex)
        return False
    else:
        session = boto3.Session(
            aws_access_key_id=config["aws_access_key_id"],
            aws_secret_access_key=config["aws_secret_access_key"],
            region_name=config["aws_region"],
        )
        sqs = session.resource("sqs")
        queue = sqs.get_queue_by_name(QueueName=config["evaluation_sqs_queue"])
        msg = {"model_id": model_id, "dataset_name": dataset_name}
        queue.send_message(MessageBody=json.dumps(msg))
        if logger:
            logger.info(f"Sent message {msg}")
        return True


def generate_job_name(endpoint_name, dataset_name, perturb_prefix=None):
    # :63 is AWS requirement; timestamp has fewer digits than uuid and should be
    # sufficient for dedup purpose
    perturb_prefix = f"{perturb_prefix}-" if perturb_prefix else ""
    timestamp = str(int(time.time()))
    jobname_prefix = f"{endpoint_name}-{perturb_prefix}{dataset_name}"[
        : 62 - len(timestamp)
    ]
    return f"{jobname_prefix}-{timestamp}"


def round_end_dt(dt, delta=60, offset=1):
    delta = timedelta(seconds=delta)
    dt_naive = dt.replace(tzinfo=None)
    ceil = dt_naive + (datetime.min - dt_naive) % delta
    return ceil.replace(tzinfo=dt.tzinfo) + timedelta(seconds=offset)


def round_start_dt(dt, delta=60, offset=1):
    delta = timedelta(seconds=delta)
    dt_naive = dt.replace(tzinfo=None)
    floor = dt_naive - (dt_naive - datetime.min) % delta
    return floor.replace(tzinfo=dt.tzinfo) - timedelta(seconds=offset)


def process_aws_metrics(datapoints):
    """
    Datapoints are a list of dictionaries with exactly the same keys
    """
    return sum([data["Average"] for data in datapoints]) / len(datapoints)


def get_perturb_prefix(dataset_name, datasets):
    if dataset_name in datasets:
        return dataset_name, None

    perturb_prefix = dataset_name.split("-")[0]
    dataset_name = dataset_name[len(perturb_prefix) + 1 :]
    if dataset_name in datasets:
        return dataset_name, perturb_prefix
    else:
        raise RuntimeError(f"Dataset {dataset_name} not found.")


def get_perturbed_filename(filename, perturb_prefix=None):
    filename = f"{perturb_prefix}-{filename}" if perturb_prefix else filename
    return filename


def get_data_s3_path(task, filename, perturb_prefix=None):
    filename = get_perturbed_filename(filename, perturb_prefix)
    return os.path.join("datasets", task, filename)


def path_available_on_s3(s3_client, s3_bucket, path, perturb_prefix=None):
    response = s3_client.list_objects_v2(Bucket=s3_bucket, Prefix=path)
    for obj in response.get("Contents", []):
        if obj["Key"] == path:
            return True
    return False
