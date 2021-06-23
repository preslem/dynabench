# Copyright (c) Facebook, Inc. and its affiliates.

from metrics import metrics


# all eval_metrics takes predictions and targets as input, and output a metric number
eval_metrics_config = {
    "accuracy": metrics.get_accuracy,
    "macro_f1": metrics.get_macro_f1,
    "squad_f1": metrics.get_squad_f1,
    "bleu": metrics.get_bleu,
    "sp_bleu": metrics.get_sp_bleu,
}

delta_metrics_config = {
    "fairness": metrics.get_unperturbed_percent,
    "robustness": metrics.get_unperturbed_percent,
}

job_metrics_config = {
    "memory_utilization": metrics.get_memory_utilization,
    "examples_per_second": metrics.get_examples_per_second,
}

metrics_meta_config = {
    "accuracy": metrics.get_accuracy_meta,
    "macro_f1": metrics.get_macro_f1_meta,
    "squad_f1": metrics.get_squad_f1_meta,
    "bleu": metrics.get_bleu_meta,
    "sp_bleu": metrics.get_sp_bleu_meta,
    "memory_utilization": metrics.get_memory_utilization_meta,
    "examples_per_second": metrics.get_examples_per_second_meta,
    "fairness": metrics.get_fairness_meta,
    "robustness": metrics.get_robustness_meta,
}
