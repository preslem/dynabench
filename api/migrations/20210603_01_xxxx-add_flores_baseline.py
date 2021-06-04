# Copyright (c) Facebook, Inc. and its affiliates.

"""
Add baseline scores from Flores101 paper.
"""
import json
from collections import defaultdict
from pathlib import Path

from yoyo import step


__depends__ = {
    "20210503_01_xxxx-add-flores-task",
}


TRACK_LANGS: dict[str, list[str]] = {
    "flores_small1": ["eng", "est", "hrv", "hun", "mkd", "srp"],
    "flores_small2": ["eng", "ind", "jav", "msa", "tam", "tgl"],
    "flores_full": (
        "afr,amh,ara,asm,ast,azj,bel,ben,bos,bul,cat,ceb,ces,ckb,cym,dan,deu,ell,"
        "eng,est,fas,fin,fra,ful,gle,glg,guj,hau,heb,hin,hrv,hun,hye,ibo,ind,isl,"
        "ita,jav,jpn,kam,kan,kat,kaz,kea,khm,kir,kor,lao,lav,lin,lit,ltz,lug,luo,"
        "mal,mar,mkd,mlt,mon,mri,msa,mya,npi,nld,nob,nso,nya,oci,orm,ory,pan,pol,"
        "por,pus,ron,rus,slk,slv,sna,snd,som,spa,srp,swe,swh,tam,tel,tgk,tgl,tha,"
        "tur,ukr,umb,urd,uzb,vie,wol,xho,yor,zho_simp,zho_trad,zul"
    ).split(","),
}


def read_csv_scores(split: str) -> dict[str, dict[str, float]]:
    file = Path(__file__).with_suffix(f".{split}.csv")
    header, *lines = file.read_text().splitlines()
    langs = [l for l in header.split(",") if l]
    # assert len(langs) == 102
    # assert len(set(langs)) == 102

    scores: dict = defaultdict(dict)
    for line_no, line in enumerate(lines):
        src, *raw_scores = line.split(",")
        assert src in langs
        assert len(raw_scores) == len(langs)
        for tgt, raw_score in zip(langs, raw_scores):
            if tgt == src:
                assert raw_score == "-"
                continue
            scores[src][tgt] = float(raw_score)

    return scores


def to_metadata_dict(task: str, scores: dict) -> dict:
    langs = TRACK_LANGS[task]
    perf_by_tag = []
    bleu_sum, count = 0, 0
    for src, row in scores.items():
        if src not in langs:
            continue
        for tgt, score in row.items():
            if tgt not in langs:
                continue
            perf = {
                "tag": f"{src}-{tgt}",
                "pretty_perf": f"{score:.1f}",
                "perf": score,
                "perf_dict": {"sp_bleu": score},
            }
            bleu_sum += score
            count += 1
            perf_by_tag.append(perf)

    return {"sp_bleu": bleu_sum / count, "perf_by_tag": perf_by_tag}


def curry(f):
    def f_curried(task, *args):
        return lambda conn: f(task, *args, conn)

    return f_curried


def get_tid(cursor, task_code: str) -> str:
    assert cursor.execute(f"SELECT id FROM tasks WHERE task_code='{task_code}'") == 1
    results = cursor.fetchall()
    assert len(results) == 1
    tid = results[0][0]
    return tid


def get_round_id(cursor, tid: str) -> str:
    assert cursor.execute(f"SELECT id FROM rounds WHERE tid='{tid}' AND rid=1")
    results = cursor.fetchall()
    assert len(results) == 1
    round_id = results[0][0]
    return round_id


def get_did(cursor, tid: str, split: str):
    assert cursor.execute("SELECT id, name FROM datasets WHERE tid=%s", (tid,))
    results = cursor.fetchall()
    # print(results)
    assert len(results) >= 1
    split_suffix = "-" + split
    for did, name in results:
        if name.endswith(split_suffix):
            return did
    raise Exception(f"Split not found {split} in {results}")


def get_mid(cursor, task):
    cursor.execute(f"SELECT id FROM models WHERE name='M2M-124-615M-csv-{task}'")
    results = cursor.fetchall()
    assert len(results) == 1
    mid = results[0][0]
    return mid


@curry
def insert_model(task: str, conn):
    cursor = conn.cursor()
    exists = cursor.execute(f"SELECT id FROM models WHERE name='M2M-124-615M-csv-{task}'")
    if exists:
        return
    cursor.execute(
        """INSERT INTO `models` (tid, uid, name, shortname, `desc`)
    VALUES (%s, 1, %s, %s, %s)""",
        (
            get_tid(cursor, task),
            f"M2M-124-615M-csv-{task}",
            f"M2M-124-615M-csv-{task}",
            "M2M-124 model (615M params) from Flores 101 paper",
        ),
    )


@curry
def insert_scores(task: str, split: str, conn):
    scores = read_csv_scores(split)
    metadata_json = to_metadata_dict(task, scores)
    file = Path(__file__).parent.parent.parent / f"M2M-124-675M-csv-{task}-{split}.json"
    file.write_text(json.dumps(metadata_json))
    cursor = conn.cursor()
    tid = get_tid(cursor, task)
    sp_bleu = metadata_json["sp_bleu"]
    insert_query = """
        INSERT INTO `scores`
        (mid, r_realid, did, `desc`, metadata_json, perf, pretty_perf)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    args = (
        get_mid(cursor, task=task),
        get_round_id(cursor, tid=tid),
        get_did(cursor, tid=tid, split=split),
        "M2M-124 model (615M params) scores from Flores 101 paper",
        json.dumps(metadata_json),
        sp_bleu,
        f"{sp_bleu:.1f}",
    )
    cursor.execute(insert_query, args)


@curry
def delete_scores(task: str, split: str, conn):
    cursor = conn.cursor()
    tid = get_tid(cursor, task)
    cursor.execute(
        "DELETE FROM scores WHERE mid=%s AND r_realid=%s AND did=%s",
        (
            get_mid(cursor, task=task),
            get_round_id(cursor, tid=tid),
            get_did(cursor, tid=tid, split=split),
        ),
    )


steps = []
tasks = ["flores_small1", "flores_small2", "flores_full"]
for task in tasks:
    steps.append(
        step(
            insert_model(task),
            f"DELETE FROM models WHERE name='M2M-124-615M-csv-{task}' and uid=1",
        )
    )
    for split in ["dev", "devtest"]:
        steps.append(step(insert_scores(task, split), delete_scores(task, split)))
