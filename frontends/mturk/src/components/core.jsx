import React from "react";

import { DivyanshNLITaskPreview, DivyanshNLITaskOnboarder, DivyanshNLITaskMain } from './divyansh/nli-1/core.jsx';
import { DivyanshQATaskPreview, DivyanshQATaskOnboarder, DivyanshQATaskMain } from './divyansh/qa-1/core.jsx';
import { NLITaskPreview, NLITaskOnboarder, NLITaskMain } from './nli-1/core.jsx';

const TaskComponents = {
  'divyansh-nli-1': [DivyanshNLITaskPreview, DivyanshNLITaskOnboarder, DivyanshNLITaskMain],
  'divyansh-qa-1': [DivyanshQATaskPreview, DivyanshQATaskOnboarder, DivyanshQATaskMain],
  'nli-1': [NLITaskPreview, NLITaskOnboarder, NLITaskMain]
  // TODO: New tasks are added here
};

class TaskFrontend extends React.Component {
  constructor(props) {
    super(props);
    this.api = props.api;
    if (props.initialTaskData) {
      this.task = props.initialTaskData.task_id;
    } else {
      this.task = 'divyansh-nli-1';
    }
  }
  render() {
    const [ TaskPreview, TaskOnboarder, TaskMain ] = TaskComponents[this.task];
    if (this.props.isPreview) {
      return <TaskPreview {...this.props} />;
    } else if (this.props.isOnboarding) {
      return <TaskOnboarder {...this.props} />;
    } else {
      return <TaskMain {...this.props} />;
    }
  }
}

export { TaskFrontend };
