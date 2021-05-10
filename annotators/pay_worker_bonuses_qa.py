#!/usr/bin/env python3
# Copyright (c) Facebook, Inc. and its affiliates.

import os  # isort:skip
import sys  # isort:skip

if os.path.exists("./Mephisto"):  # isort:skip
    sys.path.append(os.path.abspath("./Mephisto"))  # isort:skip
    print("WARNING: Loading Mephisto from local directory")  # isort:skip

from mephisto.abstractions.databases.local_database import LocalMephistoDB
from mephisto.tools.data_browser import DataBrowser as MephistoDataBrowser
from mephisto.data_model.worker import Worker
from mephisto.data_model.unit import Unit

import pandas as pd


BONUS = 0.50
HIT_PRICE = 1.00

# parsed_validations = pd.read_csv(
#     input("Enter name of the file outputted by your processing script "), sep="\t"
# )

val_file_path = "annotated_data/val.csv"
parsed_validations = pd.read_csv(val_file_path)

# Process parsing
def calculate_bonus(row):
    if row['model_wrong'] == True and row['val_approved'] in ['yes', 'empty']:
        return BONUS
    return 0.0

parsed_validations["keep"] = 'a'
parsed_validations["sendbonus"] = parsed_validations.apply(calculate_bonus, axis=1)

# Reduce to HITs
assignment_ids = list(parsed_validations["assignment_id"].unique())
parsed_val_dict = {
    i: {
        'id': i,
        'agentId': list(parsed_validations.loc[parsed_validations["assignment_id"] == assignment_id]['agent_id'].values)[0],
        'keep': 'a',
        'sendbonus': parsed_validations.loc[parsed_validations["assignment_id"] == assignment_id]['sendbonus'].sum(),
    }
    for i, assignment_id in enumerate(assignment_ids)
}
parsed_validations = pd.DataFrame.from_dict(parsed_val_dict).T

print(f"Keeping {len(parsed_validations.loc[parsed_validations['keep'] == 'a'])} HITs")
print(f"Paying approx ${HIT_PRICE * (len(parsed_validations.loc[parsed_validations['keep'] == 'a'])):.2f}")
print(f"Paying an additional ${parsed_validations['sendbonus'].sum():.2f} in bonuses")


disqualification_name = None
# Change this to the name of your local qualification that you should
# have already registered with MTurk and Mephisto

db = LocalMephistoDB()
mephisto_data_browser = MephistoDataBrowser(db=db)

DO_REVIEW = True
AUTO_REJECT = True

def format_for_printing_data(data):
    # Custom tasks can define methods for how to display their data in a
    # relevant way
    worker_name = Worker(db, data["worker_id"]).worker_name
    contents = data["data"]
    duration = contents["times"]["task_end"] - contents["times"]["task_start"]
    duration = int(duration)
    metadata_string = (
        f"Worker: {worker_name}\nUnit: {data['unit_id']}\n"
        f"Duration: {duration}\nStatus: {data['status']}\n"
    )

    inputs = contents["inputs"]
    if inputs and len(inputs) > 0:
        inputs_string = (
            f"Character: {inputs['character_name']}\n"
            f"Description: {inputs['character_description']}\n"
        )
    else:
        inputs_string = "Character: None\nDescription: None\n"
    outputs = contents["outputs"]
    output_string = f"   Outputs: {outputs}\n"
    found_files = outputs.get("files")
    if found_files is not None:
        file_dir = Unit(db, data["unit_id"]).get_assigned_agent().get_data_dir()
        output_string += f"   Files: {found_files}\n"
        output_string += f"   File directory {file_dir}\n"
    else:
        output_string += "   Files: No files attached\n"
    return f"-------------------\n{metadata_string}{inputs_string}{output_string}"


#### CONDITION WHETHER VALIDATION EXISTS

num_approved = 0
bonus_sent = 0

for itr, agentId in enumerate(parsed_validations["agentId"]):
    unit_list = db.find_units(agent_id=int(agentId))
    if len(unit_list) == 0:
        continue
    unit = unit_list[0]
    if unit.get_assigned_agent() is None:
        continue
    if unit.get_status() == "completed":
        try:
            print(
                format_for_printing_data(mephisto_data_browser.get_data_from_unit(unit))
            )
        except Exception as e:
            print(e.message)
            if unit.get_assigned_agent() is None:
                continue
        keep = parsed_validations.loc[itr, "keep"]
        sendbonus = parsed_validations.loc[itr, "sendbonus"]
        if keep == "a":
            unit.get_assigned_agent().approve_work()
            num_approved += 1
            sendbonus = round(sendbonus, 2)
            if sendbonus > 0:
                unit.get_assigned_agent().get_worker().bonus_worker(
                    amount=sendbonus,
                    reason="Bonus for validated questions that fooled the model",
                    unit=unit,
                )
                bonus_sent += sendbonus
        elif keep == "r":
            if AUTO_REJECT:
                reason = (
                    "We validated your work and over 3 out of 5 questions "
                    + "do not satisfy the instructions. Unfortunately we'll have "
                    + "to reject this HIT."
                )
            else:
                reason = input("Why are you rejecting this work?")
            unit.get_assigned_agent().reject_work(reason)
        elif keep == "p":
            # General best practice is to accept borderline work and then disqualify
            # the worker from working on more of these tasks
            agent = unit.get_assigned_agent()
            agent.soft_reject_work()
            sendbonus = round(sendbonus, 2)
            if sendbonus > 0:
                unit.get_assigned_agent().get_worker().bonus_worker(
                    amount=sendbonus,
                    reason="Bonus for validated questions that fooled the model",
                    unit=unit,
                )
            worker = agent.get_worker()
            worker.grant_qualification(disqualification_name, 1)
    else:
        continue

print(f"{num_approved} HITs have been approved at a cost of ${num_approved*HIT_PRICE:.2f}.")
print(f"Additionally, ${bonus_sent:.2f} worth of bonuses have been sent.")
