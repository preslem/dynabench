# Copyright (c) Facebook, Inc. and its affiliates.

import json
import os
import sys


# This was needed to import the models package.
sys.path.append("..")

baseUrl = "http://images.cocodataset.org/annotations"

imageUrl = "https://dl.fbaipublicfiles.com/dynabench/coco/{}/{}.jpg"

datasets = {
    "image_info_test2015": ["image_info_test2015"],
    "annotations_trainval2014": [
        # Could be any of the jsons in the zip.
        "person_keypoints_train2014",
        "person_keypoints_val2014",
    ],
}


def getImagesFromFile(fileName):
    path = f"annotations/{fileName}.json"
    with open(path) as jsonFile:
        anns = json.load(jsonFile)
        return anns["images"]


def main():

    from models.context import Context
    from models.round import RoundModel
    from models.task import TaskModel

    rid = 1
    tm = TaskModel()
    task = tm.getByShortName("VQA")
    rm = RoundModel()
    round = rm.getByTidAndRid(task.id, rid)

    # Connect to the task model database session
    dbs = tm.dbs

    for ds in datasets:

        if not os.path.exists(f"{ds}.zip"):
            os.system(f"wget {baseUrl}/{ds}.zip")
            os.system(f"unzip {ds}.zip")

        for f in datasets[ds]:

            setName = f.split("_")[-1]
            images = getImagesFromFile(f)
            data = []
            # for image in images:
            for i in range(5):
                image = images[i]
                fileName = image["file_name"]
                url = baseUrl.format(setName, fileName)
                if url is not None:
                    data.append(
                        {
                            "context": url,
                            "metadata_json": json.dumps(
                                {
                                    "id": image["id"],
                                    "file_name": fileName,
                                    "date_captured": image["date_captured"],
                                }
                            ),
                        }
                    )

            for context in data:
                url = context["context"]
                md = context["metadata_json"]
                c = Context(round=round, context=url, metadata_json=md, tag=setName)
                dbs.add(c)
                dbs.flush()

            dbs.commit()


if __name__ == "__main__":
    main()
