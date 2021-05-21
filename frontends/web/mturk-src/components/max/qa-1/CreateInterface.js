/*
 * Copyright (c) Facebook, Inc. and its affiliates.
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from "react";
import {
  Container,
  Row,
  Col,
  Card,
  CardGroup,
  Button,
  Nav,
  Table,
  FormControl,
  Spinner,
  ProgressBar,
  InputGroup,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import { FaInfoCircle, FaThumbsUp, FaThumbsDown } from "react-icons/fa";

// import UserContext from './UserContext';
import { TokenAnnotator, TextAnnotator } from "react-text-annotate";
import IdleTimer from "react-idle-timer";

import "./CreateInterface.css";

class ContextInfo extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return this.props.taskType == "extract" ? (
      <>
        <TokenAnnotator
          style={{
            lineHeight: 1.5,
          }}
          className="context"
          tokens={this.props.text.split(/\b/)}
          value={this.props.answer}
          onChange={this.props.updateAnswer}
          getSpan={(span) => ({
            ...span,
            tag: "ANS",
          })}
        />
        <p>
          <small>
            <strong>Your goal:</strong> enter a question and select an answer in
            the passage that the AI can't answer.
          </small>
        </p>
      </>
    ) : (
      <>
        <div className="context">{this.props.text}</div>
        <p>
          <small>
            <strong>Your goal:</strong> enter a{" "}
            <strong>{this.props.targets[this.props.curTarget]}</strong>{" "}
            statement that fools the model.
          </small>
        </p>
      </>
    );
  }
}

class CreateInterface extends React.Component {
  constructor(props) {
    super(props);
    this.api = props.api;
    this.model_name = props.model_name;
    this.model_url = props.model_url;
    this.state = {
      answer: [],
      taskId: props.taskConfig.task_id,
      task: {},
      context: null,
      target: 0,
      modelPredIdx: null,
      modelPredStr: "",
      hypothesis: "",
      content: [],
      submitDisabled: true,
      generateDisabled: true,
      refreshDisabled: true,
      progressSubmitting: false,
      progressGenerating: false,
      numQuestionsGenerated: 0,
      mapKeyToExampleId: {},
      exampleHistory: [],
      tries: 0,
      total_tries: 5, // NOTE: Set this to your preferred value
      taskCompleted: false,
    };
    this.getNewContext = this.getNewContext.bind(this);
    this.handleTaskSubmit = this.handleTaskSubmit.bind(this);
    this.handleResponse = this.handleResponse.bind(this);
    this.handleGeneratorResponse = this.handleGeneratorResponse.bind(this);
    this.handleVerifyResponse = this.handleVerifyResponse.bind(this);
    this.handleResponseChange = this.handleResponseChange.bind(this);
    this.retractExample = this.retractExample.bind(this);
    this.updateAnswer = this.updateAnswer.bind(this);
    // IdleTimer
    this.idleTimer = null;
    // this.handleOnAction = this.handleOnAction.bind(this)
    // this.handleOnActive = this.handleOnActive.bind(this)
    // this.handleOnIdle = this.handleOnIdle.bind(this)
  }
  getNewContext() {
    this.setState(
      { submitDisabled: true, generateDisabled: true, refreshDisabled: true },
      function () {
        // this.api.getRandomContext(this.state.taskId, this.state.task.cur_round, ['test'])
        this.api
          .getRandomContext(this.state.taskId, this.state.task.cur_round)
          .then((result) => {
            var randomTarget = Math.floor(
              Math.random() * this.state.task.targets.length
            );
            this.setState({
              target: randomTarget,
              context: result,
              content: [{ cls: "context", text: result.context }],
              submitDisabled: false,
              generateDisabled: false,
              refreshDisabled: false,
              exampleHistory: [
                {
                  timestamp: new Date().valueOf(),
                  answer: "",
                  question: "",
                  questionType: "",
                  questionCacheId: null,
                  activityType: "Context loaded",
                },
              ],
            });
          })
          .catch((error) => {
            console.log(error);
          });
      }
    );
  }
  retractExample(e) {
    e.preventDefault();
    var idx = e.target.getAttribute("data-index");
    this.api
      .retractExample(
        this.state.mapKeyToExampleId[idx],
        this.props.providerWorkerId
      )
      .then((result) => {
        const newContent = this.state.content.slice();
        newContent[idx].cls = "retracted";
        newContent[idx].retracted = true;
        this.state.tries -= 1;
        this.setState({ content: newContent });
      })
      .catch((error) => {
        console.log(error);
      });
  }
  handleTaskSubmit() {
    this.props.onSubmit(this.state);
  }
  handleResponse(e) {
    e.preventDefault();

    // MAXEDIT: to remove
    console.log(this.state.exampleHistory);

    if (this.state.numQuestionsGenerated <= 0) {
      if (
        !window.confirm(
          "The question generator is there to assist you. Are you sure you want to continue without any question suggestions?"
        )
      ) {
        return;
      }
    }

    this.setState(
      {
        progressSubmitting: true,
        submitDisabled: true,
        generateDisabled: true,
        refreshDisabled: true,
        hypothesisNotDetected: false,
      },
      function () {
        if (this.state.hypothesis.length == 0) {
          this.setState({
            progressSubmitting: false,
            submitDisabled: false,
            generateDisabled: false,
            refreshDisabled: false,
            hypothesisNotDetected: true,
          });
          return;
        }
        if (
          this.state.task.type == "extract" &&
          this.state.answer.length == 0
        ) {
          this.setState({
            progressSubmitting: false,
            submitDisabled: false,
            generateDisabled: false,
            refreshDisabled: false,
            answerNotSelected: true,
          });
          return;
        }
        if (this.state.task.type == "extract") {
          var answer_text = "";
          if (this.state.answer.length > 0) {
            var last_answer = this.state.answer[this.state.answer.length - 1];
            var answer_text = last_answer.tokens.join(""); // NOTE: no spaces required as tokenising by word boundaries
            // Update the target with the answer text since this is defined by the annotator in QA (unlike NLI)
            this.setState({
              target: answer_text,
            });
          }
        } else {
          var answer_text = null;
        }
        let modelInputs = {
          context: this.state.context.context,
          hypothesis: this.state.hypothesis,
          answer: answer_text,
          insight: false,
        };
        // this.model_url was this.state.task.round.url
        this.api
          .getModelResponse(this.model_url, modelInputs)
          .then((result) => {
            if (this.state.task.type != "extract") {
              var modelPredIdx = result.prob.indexOf(Math.max(...result.prob));
              var modelPredStr = this.state.task.targets[modelPredIdx];
              var modelFooled =
                result.prob.indexOf(Math.max(...result.prob)) !==
                this.state.target;
            } else {
              var modelPredIdx = null;
              var modelPredStr = result.text;
              var modelFooled = !result.model_is_correct;
              // TODO: Handle this more elegantly:
              result.prob = [result.prob, 1 - result.prob];
              this.state.task.targets = ["confidence", "uncertainty"];
            }
            this.setState(
              {
                content: [
                  ...this.state.content,
                  {
                    index: this.state.content.length,
                    cls: "hypothesis",
                    modelInputs: modelInputs,
                    modelPredIdx: modelPredIdx,
                    modelPredStr: modelPredStr,
                    fooled: modelFooled,
                    text: this.state.hypothesis,
                    retracted: false,
                    response: result,
                  },
                ],
              },
              function () {
                // var last_answer = this.state.answer[this.state.answer.length - 1];
                // var answer_text = last_answer.tokens.join("");
                const metadata = {
                  annotator_id: this.props.providerWorkerId,
                  agentId: this.props.agentId,
                  mephisto_id: this.props.mephistoWorkerId,
                  assignmentId: this.props.assignmentId,
                  current_timestamp: new Date().valueOf(),
                  timer_elapsed_time_ms: this.idleTimer.getElapsedTime(),
                  timer_active_time_ms: this.idleTimer.getTotalActiveTime(),
                  timer_idle_time_ms: this.idleTimer.getTotalIdleTime(),
                  model: "no-model",
                  model_name: this.model_name,
                  model_url: this.model_url,
                  current_tries: this.state.tries,
                  exampleHistory: JSON.stringify(this.state.exampleHistory),
                  modelInputs: modelInputs,
                  fullresponse:
                    this.state.task.type == "extract"
                      ? JSON.stringify(this.state.answer)
                      : this.state.target,
                };
                console.log("metadata:");
                console.log(metadata);
                this.api
                  .storeExample(
                    this.state.task.id,
                    this.state.task.cur_round,
                    "turk",
                    this.state.context.id,
                    this.state.hypothesis,
                    this.state.task.type == "extract"
                      ? answer_text
                      : this.state.target,
                    result,
                    metadata
                  )
                  .then((result) => {
                    var key = this.state.content.length - 1;
                    this.state.tries += 1;
                    this.setState(
                      {
                        hypothesis: "",
                        progressSubmitting: false,
                        submitDisabled: false,
                        generateDisabled: false,
                        refreshDisabled: false,
                        mapKeyToExampleId: {
                          ...this.state.mapKeyToExampleId,
                          [key]: result.id,
                        },
                        answer: [],
                        exampleHistory: [],
                      },
                      function () {
                        if (this.state.tries == this.state.total_tries) {
                          console.log("Success! You can submit the HIT");
                          this.setState({
                            taskCompleted: true,
                            generateDisabled: true,
                          });
                        }
                      }
                    );
                  })
                  .catch((error) => {
                    console.log(error);
                  });
              }
            );
          })
          .catch((error) => {
            console.log(error);
          });
      }
    );
  }
  handleGeneratorResponse(e) {
    e.preventDefault();
    this.setState(
      {
        progressGenerating: true,
        submitDisabled: true,
        generateDisabled: true,
        refreshDisabled: true,
        hypothesisNotDetected: false,
      },
      function () {
        if (
          this.state.task.type == "extract" &&
          this.state.answer.length == 0
        ) {
          this.setState({
            progressGenerating: false,
            submitDisabled: false,
            generateDisabled: false,
            refreshDisabled: false,
            answerNotSelected: true,
          });
          return;
        }
        if (this.state.task.type == "extract") {
          var answer_text = "";
          if (this.state.answer.length > 0) {
            var last_answer = this.state.answer[this.state.answer.length - 1];
            var answer_text = last_answer.tokens.join(""); // NOTE: no spaces required as tokenising by word boundaries
            // Update the target with the answer text since this is defined by the annotator in QA (unlike NLI)
            this.setState({
              target: answer_text,
            });
          }
        } else {
          var answer_text = null;
        }

        // Get last questionCacheId for a cached example for this answer
        var question_cache_id = -1;
        for (var i = this.state.exampleHistory.length - 1; i >= 0; i--) {
          let item = this.state.exampleHistory[i];
          if (
            item["answer"] == answer_text &&
            item["questionType"] == "cache"
          ) {
            question_cache_id = parseInt(item["questionCacheId"]);
            break;
          }
        }

        let modelInputs = {
          context: this.state.context.context,
          answer: answer_text,
          hypothesis: question_cache_id,
        };
        console.log("model inputs:");
        console.log(modelInputs);
        console.log("example history:");

        let generator_url =
          "http://0.0.0.0:8097/cce63f4d8238fc8061a2e3a268afe1c14c0e2135580bc1680aec62dc20f68e81";
        // this.model_url was this.state.task.round.url
        this.api
          .getModelResponse(generator_url, modelInputs)
          .then((result) => {
            // console.log(result);
            this.setState({
              hypothesis: result["question"],
              progressGenerating: false,
              submitDisabled: false,
              generateDisabled: false,
              refreshDisabled: false,
              exampleHistory: [
                ...this.state.exampleHistory,
                {
                  timestamp: new Date().valueOf(),
                  answer: answer_text,
                  question: result["question"],
                  questionType: result["question_type"], // cache or generated or manual
                  questionCacheId: result["question_cache_id"],
                  activityType: "Generated a question",
                },
              ],
              numQuestionsGenerated: this.state.numQuestionsGenerated + 1,
            });
            console.log(this.state.exampleHistory);
          })
          .catch((error) => {
            console.log(error);
          });
      }
    );
  }
  handleVerifyResponse(action) {
    var action_label = null;
    switch (action) {
      case "yes":
        action_label = "yes";
        break;
      case "no":
        action_label = "no";
        break;
    }
    if (action_label !== null) {
      this.setState({ label: action_label });
      var metadata = { annotator_id: this.props.providerWorkerId };
      this.api
        .validateExample(this.state.example.id, action, "user", metadata)
        .then(
          (result) => {
            this.props.onSubmit(this.state);
          },
          (error) => {
            console.log(error);
          }
        );
    }
  }
  handleResponseChange(e) {
    this.setState({
      hypothesis: e.target.value,
      exampleHistory: [
        ...this.state.exampleHistory,
        {
          timestamp: new Date().valueOf(),
          answer: "",
          question: e.target.value,
          questionType: "manual",
          questionCacheId: null,
          activityType: "Question modified manually",
        },
      ],
    });
  }
  // handleOnAction (event) {
  //   console.log('user did something', event)
  // }
  // handleOnActive (event) {
  //   console.log('user is active', event)
  //   console.log('time remaining', this.idleTimer.getRemainingTime())
  // }
  // handleOnIdle (event) {
  //   console.log('user is idle', event)
  //   console.log('last active', this.idleTimer.getLastActiveTime())
  // }
  componentDidMount() {
    this.api
      .getTask(this.state.taskId)
      .then((result) => {
        result.targets = result.targets.split("|"); // split targets
        this.setState({ task: result }, function () {
          this.getNewContext();
        });
      })
      .catch((error) => {
        console.log(error);
      });
  }
  updateAnswer(value) {
    // Only keep the last answer annotated
    if (value.length > 0) {
      this.setState({
        answer: [value[value.length - 1]],
        answerNotSelected: false,
        exampleHistory: [
          ...this.state.exampleHistory,
          {
            timestamp: new Date().valueOf(),
            answer: [value[value.length - 1]],
            question: "",
            questionType: "",
            questionCacheId: null,
            activityType: "Answer changed",
          },
        ],
      });
    } else {
      this.setState({ answer: value, answerNotSelected: false });
    }
  }

  render() {
    let content_list = this.state.content;
    if (content_list.length > 1) {
      content_list = [content_list[0], ...content_list.slice(1).reverse()];
    }

    const content = content_list.map((item, index) =>
      item.cls == "context" ? (
        <ContextInfo
          key={item.index}
          index={item.index}
          text={item.text}
          targets={this.state.task.targets}
          curTarget={this.state.target}
          taskType={this.state.task.type}
          answer={this.state.answer}
          updateAnswer={this.updateAnswer}
        />
      ) : (
        <div
          key={item.index}
          className={
            item.cls +
            " rounded border " +
            (item.retracted
              ? "border-warning"
              : item.fooled
              ? "border-success"
              : "border-danger")
          }
          style={{ borderWidth: 2 }}
        >
          <Row>
            <div className="col-sm-9">
              <div>
                Q{item.index}: <strong>{item.text}</strong>
              </div>
              <div>
                A{item.index}: <strong>{item.modelInputs.answer}</strong>
              </div>
              <small>
                {item.retracted ? (
                  <>
                    <span>
                      <strong>Example retracted</strong> - thanks. The AI
                      predicted <strong>{item.modelPredStr}</strong>. Please try
                      again!
                    </span>
                  </>
                ) : item.fooled ? (
                  <>
                    <span>
                      <strong>Well done</strong>, you fooled the AI! The AI
                      predicted <strong>{item.modelPredStr}</strong> instead.{" "}
                    </span>
                    <br />
                    <hr />
                    <div>
                      <OverlayTrigger
                        placement="top"
                        delay={{ show: 250, hide: 400 }}
                        overlay={
                          <Tooltip id={`tooltip-confirm`}>
                            This helps us speed up validation and pay bonuses
                            out quicker!
                          </Tooltip>
                        }
                      >
                        <FaInfoCircle />
                      </OverlayTrigger>
                      &nbsp; Can you please confirm that "
                      <strong>{item.modelInputs.answer}</strong>" is the correct
                      answer to the question and that the model's prediction "
                      <strong>{item.modelPredStr}</strong>" is wrong? &nbsp;
                      <InputGroup className="mt-1">
                        <Button
                          className="btn btn-success mr-1"
                          style={{ padding: "0.2rem 0.5rem" }}
                          onClick={this.handleVerifyResponse("yes")}
                          disabled={this.state.verifyDisabled}
                        >
                          <FaThumbsUp style={{ marginTop: "-0.25em" }} />
                        </Button>

                        <Button
                          className="btn btn-danger mr-1"
                          style={{ padding: "0.2rem 0.5rem" }}
                          onClick={this.handleVerifyResponse("no")}
                          disabled={this.state.verifyDisabled}
                        >
                          <FaThumbsDown style={{ marginTop: "-0.25em" }} />
                        </Button>
                      </InputGroup>
                    </div>
                  </>
                ) : (
                  <>
                    <span>
                      <strong>Bad luck!</strong> The AI correctly predicted{" "}
                      <strong>{item.modelPredStr}</strong>. Please try again.
                    </span>
                  </>
                )}
              </small>
            </div>
            <div className="col-sm-3" style={{ textAlign: "right" }}>
              <small>
                <em>AI Confidence:</em>
              </small>
              <ProgressBar
                striped
                variant="success"
                now={(item.response.prob[0] * 100).toFixed(1)}
                label={`${(item.response.prob[0] * 100).toFixed(1)}%`}
              />
            </div>
          </Row>
        </div>
      )
    );
    if (this.state.taskCompleted) {
      var taskTracker = (
        <Button
          className="btn btn-primary btn-success mt-2"
          onClick={this.handleTaskSubmit}
        >
          Submit HIT
        </Button>
      );
    } else {
      var taskTracker = (
        <small style={{ marginTop: "18px" }}>
          &nbsp;Questions submitted:{" "}
          <strong>
            {this.state.tries}/{this.state.total_tries}
          </strong>
        </small>
      );
    }

    var errorMessage = "";
    if (this.state.hypothesisNotDetected === true) {
      var errorMessage = (
        <div>
          <small style={{ color: "red" }}>* Please enter a question</small>
        </div>
      );
    }
    if (this.state.answerNotSelected === true) {
      var errorMessage = (
        <div>
          <small style={{ color: "red" }}>
            * Please select an answer from the passage
          </small>
        </div>
      );
    }
    return (
      <Container>
        <IdleTimer
          ref={(ref) => {
            this.idleTimer = ref;
          }}
          timeout={1000 * 60 * 1} // last number is value in minutes
          onActive={this.handleOnActive}
          onIdle={this.handleOnIdle}
          onAction={this.handleOnAction}
          debounce={250}
        />
        <Row>
          <CardGroup style={{ marginTop: 4, width: "100%" }}>
            <Card border="dark">
              <Card.Body style={{ height: 400, overflowY: "scroll" }}>
                {content}
              </Card.Body>
            </Card>
          </CardGroup>
          <InputGroup className="mt-3">
            <FormControl
              placeholder={
                this.state.task.type == "extract"
                  ? "Ask a question.."
                  : "Type your question.."
              }
              value={this.state.hypothesis}
              onChange={this.handleResponseChange}
              required
            />
            <InputGroup.Append>
              <Button
                className="btn btn-info mr-1"
                onClick={this.handleGeneratorResponse}
                disabled={this.state.generateDisabled}
              >
                Generate Question
                {this.state.progressGenerating ? (
                  <Spinner
                    className="ml-2"
                    animation="border"
                    role="status"
                    size="sm"
                  />
                ) : null}
              </Button>
            </InputGroup.Append>
          </InputGroup>
          <InputGroup>
            <p>
              <small className="form-text text-muted">
                Remember, the goal is to find an example that the AI gets wrong
                but that another person would get right. Load time may be slow;
                please be patient.
              </small>
            </p>
          </InputGroup>
          {errorMessage}
          <InputGroup>
            {this.state.taskCompleted ? null : (
              <Button
                className="btn btn-primary mt-2 mr-1"
                onClick={this.handleResponse}
                disabled={this.state.submitDisabled}
              >
                Submit Question
                {this.state.progressSubmitting ? (
                  <Spinner
                    className="ml-2"
                    animation="border"
                    role="status"
                    size="sm"
                  />
                ) : null}
              </Button>
            )}
            {taskTracker}
          </InputGroup>
        </Row>
      </Container>
    );
  }
}

export { CreateInterface };
