import React from 'react';
import {Button, Container,} from 'react-bootstrap';
import {ExampleGoodCards} from "./GoodExampleCards.jsx";

var seedrandom = require('seedrandom');


class NLIWritingInterface extends React.Component {
  constructor(props) {
    super(props);
    this.api = props.api;
    this.modelURLs = [
        // "https://fhcxpbltv0.execute-api.us-west-1.amazonaws.com/predict?model=nli-r4-1", // roberta
        // "https://fhcxpbltv0.execute-api.us-west-1.amazonaws.com/predict?model=nli-r4-2", // albert
        "https://fhcxpbltv0.execute-api.us-west-1.amazonaws.com/predict?model=nli-r4-3", // xlnet
        // "https://fhcxpbltv0.execute-api.us-west-1.amazonaws.com/predict?model=nli-r4-4", // bart
        // "https://fhcxpbltv0.execute-api.us-west-1.amazonaws.com/predict?model=nli-r4-5", // electra
    ];
    // set the api to production mode
    // https://api.dynabench.org

    this.api.domain = "https://api.dynabench.org"

    this.randomPrediction = true

    this.meta_save = {
      debug_flag: false,
      experiment_flag: this.props.taskConfig.experiment_flag,
    }

    this.state = {
      // here comes the new state,

      // the data from the requester.
      reqData: {
        dataId: "",
        passage: "",
        targetLabel: 2,  //0, 1, 2
        context_response: {}, // the response from api service
      },

      // the data of the responser/annotator.
      resData: {
        statement: "",
        labelExplanation: "",
        modelExplanation: "",
      },

      modelData: {
        prob: [], //E, N, C
        predLabel: null, //0, 1, 2
        model_response: {},
      },

      last_sumbitted_example_id: null,

      showPreview: false,
      submittedOnce: false,
      submitDisabled: true,
      modelFooled: false,
      modelCalculating: false,

      chanceToSwitch: 10,

      // here we can save some meta data.
      session_id: "", // passage, mturk, target label is a session.
      number_of_tried_for_current_session: 0,
      session_start_date: null,
      last_submit_date: null,

      // other states
      answer: [],
      taskId: props.taskConfig.task_id,
      task: {},
      context: null,
      target: 0,
      modelPredIdx: null,
      modelPredStr: '',
      hypothesis: "",

      content: [],

      refreshDisabled: true,
      mapKeyToExampleId: {},
      tries: 0,
      total_tries: 10, // NOTE: Set this to your preferred value
      taskCompleted: false
    };

    // this.getNewContext = this.getNewContext.bind(this);
    this.handleTaskSubmit = this.handleTaskSubmit.bind(this);
    // this.handleResponse = this.handleResponse.bind(this);
    // this.handleResponseChange = this.handleResponseChange.bind(this);
    // this.retractExample = this.retractExample.bind(this);
    // this.updateAnswer = this.updateAnswer.bind(this);
    console.log("Log from Writing Interface! State:", this.state);
    console.log("Log from Writing Interface! API:", this.props.api);
    console.log("Log from Writing Interface! Props:", this.props);
  }

  explainExample = (id, uid, LabelExp, ModelExp) => {
    const obj = {
      example_explanation: LabelExp,
      model_explanation: ModelExp,
      uid: uid
    };

    return this.api.fetch(`${this.api.domain}/examples/${id}`, {
      method: "PUT",
      body: JSON.stringify(obj),
    });
  }

  hashCode(str) {
  return str.split('').reduce((prevHash, currVal) =>
    (((prevHash << 5) - prevHash) + currVal.charCodeAt(0))|0, 0);
  }

  mod(n, m) {
    return ((n % m) + m) % m;
  }

  create_UUID() {
    let dt = new Date().getTime();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (dt + Math.random() * 16) % 16 | 0;
      dt = Math.floor(dt / 16);
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  InitNewContext() {
    this.setState({submitDisabled: true, refreshDisabled: true, submittedOnce:false, modelFooled:false,
      number_of_tried_for_current_session: 0, session_start_date: new Date(), last_submit_date: new Date(),
      resData: {statement: "", labelExplanation: "", modelExplanation: ""}, modelData: {prob: [], predLabel: null, model_response: {}}}, function () {
      this.api.getRandomContext(this.state.taskId, this.state.task.cur_round, this.props.taskConfig.dyna_tags)
      .then(result => {
        const randomID = Math.floor(Math.random() * 100);
        const randomTarget = Math.floor(Math.random() * 3);
        // this.setState({target: randomTarget, context: result, content: [{cls: 'context', text: result.context}], submitDisabled: false, refreshDisabled: false});
        console.log("Init Context...")
        // console.log(result)
        const newReqData = {
          dataId: result.id,
          passage: result.context,
          targetLabel: randomTarget,  //0, 1, 2
          context_response: result,
        }
        // console.log(newReqData)
        this.setState({resData: {statement: "", labelExplanation: "", modelExplanation: ""}, reqData:newReqData, submitDisabled: false, refreshDisabled: false, session_id: this.create_UUID()}, function () {
          console.log("Context init finished (State):", this.state)
        });
      }, error => {
        console.log(error);
      });
    });
  }

  handleTaskSubmit() {
    this.props.onSubmit(this.state.content);
  }

  handleResponse() {
    this.setState({submitDisabled: true, refreshDisabled: true}, function () {
      if (this.state.hypothesis.length == 0) {
        this.setState({submitDisabled: false, refreshDisabled: false});
        return;
      }
      if (this.state.task.type == 'extract' && this.state.answer.length == 0) {
        this.setState({submitDisabled: false, refreshDisabled: false});
        return;
      }
      if (this.state.task.type == "extract") {
        var answer_text = "";
        if (this.state.answer.length > 0) {
          var last_answer = this.state.answer[this.state.answer.length - 1];
          var answer_text = last_answer.tokens.join(" "); // NOTE: no spaces required as tokenising by word boundaries
          // Update the target with the answer text since this is defined by the annotator in QA (unlike NLI)
          this.setState({ target: answer_text });
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
      this.api.getModelResponse(this.state.task.round.url, modelInputs)
        .then(result => {
          if (this.state.task.type != 'extract') {
            var modelPredIdx = result.prob.indexOf(Math.max(...result.prob));
            var modelPredStr = this.state.task.targets[modelPredIdx];
            var modelFooled = result.prob.indexOf(Math.max(...result.prob)) !== this.state.target;
          } else {
            var modelPredIdx = null;
            var modelPredStr = result.text;
            var modelFooled = !result.model_is_correct;
            // TODO: Handle this more elegantly:
            result.prob = [result.prob, 1 - result.prob];
            this.state.task.targets = ['confidence', 'uncertainty'];
          }
        this.setState({
          content: [...this.state.content, {
            cls: 'hypothesis',
            modelPredIdx: modelPredIdx,
            modelPredStr: modelPredStr,
            fooled: modelFooled,
            text: this.state.hypothesis,
            retracted: false,
            response: result}
          ]}, function() {
          var last_answer = this.state.answer[this.state.answer.length - 1];
          var answer_text = last_answer.tokens.join(" ");
          const metadata = {
            'annotator_id': this.props.providerWorkerId,
            'mephisto_id': this.props.mephistoWorkerId,
            'model': 'model-name-unknown',
            'agentId': this.props.agentId,
            'assignmentId': this.props.assignmentId,
            'fullresponse': this.state.task.type == 'extract' ? JSON.stringify(this.state.answer) : this.state.target
          };
          const tag = this.props.taskConfig.dyna_tags.length >= 1 ? this.props.taskConfig.dyna_tags[0] : null
          this.api.storeExample(
            this.state.task.id,
            this.state.task.cur_round,
            'turk',
            this.state.context.id,
            this.state.hypothesis,
            this.state.task.type == 'extract' ? answer_text : this.state.target,
            result,
            metadata,
            tag
          ).then(result => {
            var key = this.state.content.length-1;
            this.state.tries += 1;
            this.setState({hypothesis: "", submitDisabled: false, refreshDisabled: false, mapKeyToExampleId: {...this.state.mapKeyToExampleId, [key]: result.id}},
              function () {
                if (this.state.content[this.state.content.length-1].fooled || this.state.tries >= this.state.total_tries) {
                  console.log('Success! You can submit HIT');
                  this.setState({taskCompleted: true});
                }
              });
          }, error => {
            console.log(error);
          });
        });
      }, error => {
        console.log(error);
      });
    });
  }

  handleResponseChange(e) {
    this.setState({hypothesis: e.target.value});
  }

  isStatementSubmittable = () => {
    return this.state.resData.statement.trim().length > 25;
  }

  isExampleSubmittable = () => {
    if (this.isStatementSubmittable() === false) {
      return false
    } else if (this.state.resData.labelExplanation.trim().length <= 25) {
      return false
    } else if (this.state.resData.modelExplanation.trim().length <= 25) {
      return false
    }
    return true
  }

  handleStatementChange = (e) => {
    e.persist();
    this.setState(prevState => ({
        resData: {
            ...prevState.resData,
            statement: e.target.value
        }
    }))
  }

  handleLabelExpChange = (e) => {
    e.persist();
    this.setState(prevState => ({
        resData: {
            ...prevState.resData,
            labelExplanation: e.target.value
        }
    }))
  }

  handleModelExpChange = (e) => {
    e.persist();
    this.setState(prevState => ({
        resData: {
            ...prevState.resData,
            modelExplanation: e.target.value
        }
    }))
  }

  componentDidMount() {
    this.api.getTask(this.state.taskId)
    .then(result => {
      result.targets = result.targets.split('|'); // split targets
      this.setState({task: result}, function() {
        // this.getNewContext();
        this.InitNewContext();
        // console.log(this.state);
      });
    }, error => {
      console.log(error);
    });
  }

  retractExample = () => {
    this.api.retractExample(
      this.state.last_sumbitted_example_id,
      this.props.providerWorkerId
    )
    .then(result => {
      this.InitNewContext()
      console.log("Example Retracted:", result)
    })
    .catch(error => {
      console.log(error);
    });
  }

  finishExample = () => {
    this.explainExample(
        this.state.last_sumbitted_example_id,
        this.props.providerWorkerId,
        this.state.resData.labelExplanation,
        this.state.resData.modelExplanation,
    ).then(result => {
      console.log("One Example Updated:", result, "State:", this.state)
      this.props.onSubmit({});
    }, error => {
      console.log(error);
    });

    // some thing to submit the HIT and clean it up.
  }

  getRandomPredictions = () => {
    // get a random number her
    var rng = seedrandom(this.state.reqData.passage + this.state.resData.statement)
    const v1 = rng()
    const v2 = rng()
    const v3 = rng()
    const sum = v1 + v2 + v3

    return {
      logits: [v1, v2, v3],
      prob: [v1 / sum, v2 / sum, v3 / sum],
      s1: this.state.reqData.passage,
      s2: this.state.resData.statement,
      status: "finished",
      model_name: "no-model",
    }
    // remember to give no-model in metadata to waive the signature requirement.
  }

  submitStatementFake = () => {
    this.setState({modelCalculating: true, submittedOnce: true, submitDisabled: true}, function () {

      const modelInputs = {
        context: this.state.reqData.passage,
        hypothesis: this.state.resData.statement,
        answer: null,
        insight: false,
      };

      const randomStrValueForModelURL = this.state.reqData.passage + this.props.providerWorkerId
      const cur_modelURLIndex = this.mod(this.hashCode(randomStrValueForModelURL), this.modelURLs.length)
      const cur_modelURL = this.modelURLs[cur_modelURLIndex]
      console.log("Model URL from submitStatementFake:", cur_modelURL)

      // this.api.getModelResponse(this.state.task.round.url, modelInputs)

      // const randomArray = [Math.random(), Math.random(), Math.random()]
      // let sum = randomArray.reduce(function(a, b){
      //     return a + b;
      // }, 0);
      // const modelProb = randomArray.map((a) => {
      //   return (a / sum)
      // });
      if (this.randomPrediction) {
        const results = this.getRandomPredictions()
        const modelProb = results.prob
            const modelPredLabel = modelProb.indexOf(Math.max(...modelProb));
            // var modelPredIdx = result.prob.indexOf(Math.max(...result.prob));
            // var modelPredStr = this.state.task.targets[modelPredIdx];
            // var modelFooled = result.prob.indexOf(Math.max(...result.prob)) !== this.state.target;
            const newModelData = {
              prob: modelProb,            //E, N, C
              predLabel: modelPredLabel,  //0, 1, 2
              model_response: results
            }

            const number_of_tried = this.state.number_of_tried_for_current_session + 1
            this.setState({modelData: newModelData, submittedOnce: true, modelCalculating: false, submitDisabled: false,
              number_of_tried_for_current_session: number_of_tried}, function () {
              this.checkModelFeedback()
              console.log("Check State after submit we get model response (State):", this.state)

              const metadata = {
                session_id: this.state.session_id,
                model_url: "no-model",
                annotator_id: this.props.providerWorkerId,
                mephisto_id: this.props.mephistoWorkerId,
                agentId: this.props.agentId,
                assignmentId: this.props.assignmentId,
                session_start_date: this.state.session_start_date,
                last_submit_date: this.state.last_submit_date,
                current_date: new Date(),
                number_of_tried_for_current_session: this.state.number_of_tried_for_current_session,
                model: "no-model",
                ...this.meta_save
              }

              const tag = this.props.taskConfig.dyna_tags.length >= 1 ? this.props.taskConfig.dyna_tags[0] : null
              this.api.storeExample(
                this.state.task.id,
                this.state.task.cur_round,
                'turk',
                this.state.reqData.dataId,
                this.state.resData.statement,
                this.state.reqData.targetLabel,
                results,
                metadata,
                tag
              ).then(result => {
                this.setState({last_submit_date: new Date(), last_sumbitted_example_id: result['id']}, function () {
                  this.explainExample(
                      this.state.last_sumbitted_example_id,
                      this.props.providerWorkerId,
                      this.state.resData.labelExplanation,
                      this.state.resData.modelExplanation,
                  ).then(result => {
                    console.log("One Example Updated:", result, "State:", this.state)
                  }, error => {
                    console.log(error);
                  });
                  console.log("One Example Stored:", result, "State:", this.state)
                })
              }, error => {
                console.log(error);
              });
            })
      } else {
        this.api.getModelResponse(cur_modelURL, modelInputs)
          .then(results => {
            const modelProb = results.prob
            const modelPredLabel = modelProb.indexOf(Math.max(...modelProb));
            // var modelPredIdx = result.prob.indexOf(Math.max(...result.prob));
            // var modelPredStr = this.state.task.targets[modelPredIdx];
            // var modelFooled = result.prob.indexOf(Math.max(...result.prob)) !== this.state.target;
            const newModelData = {
              prob: modelProb,            //E, N, C
              predLabel: modelPredLabel,  //0, 1, 2
              model_response: results
            }

            const number_of_tried = this.state.number_of_tried_for_current_session + 1
            this.setState({modelData: newModelData, submittedOnce: true, modelCalculating: false, submitDisabled: false,
              number_of_tried_for_current_session: number_of_tried}, function () {
              this.checkModelFeedback()
              console.log("Check State after submit we get model response (State):", this.state)

              const metadata = {
                session_id: this.state.session_id,
                model_url: cur_modelURL,
                annotator_id: this.props.providerWorkerId,
                mephisto_id: this.props.mephistoWorkerId,
                agentId: this.props.agentId,
                assignmentId: this.props.assignmentId,
                session_start_date: this.state.session_start_date,
                last_submit_date: this.state.last_submit_date,
                current_date: new Date(),
                number_of_tried_for_current_session: this.state.number_of_tried_for_current_session,
                ...this.meta_save
              }

              const tag = this.props.taskConfig.dyna_tags.length >= 1 ? this.props.taskConfig.dyna_tags[0] : null
              this.api.storeExample(
                this.state.task.id,
                this.state.task.cur_round,
                'turk',
                this.state.reqData.dataId,
                this.state.resData.statement,
                this.state.reqData.targetLabel,
                results,
                metadata,
                tag
              ).then(result => {
                this.setState({last_submit_date: new Date(), last_sumbitted_example_id: result['id']}, function () {
                  this.explainExample(
                      this.state.last_sumbitted_example_id,
                      this.props.providerWorkerId,
                      this.state.resData.labelExplanation,
                      this.state.resData.modelExplanation,
                  ).then(result => {
                    console.log("One Example Updated:", result, "State:", this.state)
                  }, error => {
                    console.log(error);
                  });
                  console.log("One Example Stored:", result, "State:", this.state)
                })
              }, error => {
                console.log(error);
              });
            })
          })
      }

    })
  }

  checkModelFeedback = () => {
    if (this.state.modelData.predLabel !== this.state.reqData.targetLabel) {
      this.setState({modelFooled: true})
    }
  }

  switchContext = () => {
    if (this.state.chanceToSwitch > 0) {
      this.setState({chanceToSwitch: this.state.chanceToSwitch - 1}, function () {
        this.InitNewContext();
      })
    }
  }

  render() {

    const labelDescMapping = {
      0: 'definitely correct',
      1: 'neither correct nor incorrect',
      2: 'definitely incorrect',
    }

    const targetLabelDesc = `${labelDescMapping[this.state.reqData.targetLabel]}`

    // model feedback panel
    let modelFeedBack = <></>
    if (this.state.submittedOnce) {
      let modelResult = <ul>
              <li>Definitely Correct: {(this.state.modelData.prob[0] * 100).toFixed(2)} %</li>
              <li>Definitely Incorrect: {(this.state.modelData.prob[2] * 100).toFixed(2)} %</li>
              <li>Neither: {(this.state.modelData.prob[1] * 100).toFixed(2)} %</li>
          </ul>
      if (this.state.modelCalculating) {
        modelResult = <>
          <div>AI is thinking...</div>
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">AI is thinking...</span>
          </div>
        </>
      }

      modelFeedBack = <>
        <strong>The AI system thinks that the statement is:</strong>
          <div style={{color: "blue"}}>
            {modelResult}
        </div>
        </>
    }
    // end model feedback panel

    // depend on the model feedback, we give different instruction
    let feedBackDesc = <></>
    if (!this.state.modelCalculating && this.state.submittedOnce && !this.state.modelFooled) {
      feedBackDesc = <>
        <div style={{ color: "red"}}>
        <strong>Nice try! However, the AI got it correct. Try to modify your statement and fool the AI again.</strong>
        </div>
      </>
    } else if (!this.state.modelCalculating && this.state.submittedOnce && this.state.modelFooled) {
      feedBackDesc = <>
        <div>
        <strong>Great! You successfully fooled the AI.</strong> <br />
        Now, please review your statement carefully to make sure that the statement belongs to the right category and your explanation is also correct (you can still edit your explanations but you cannot edit your statement now).
        </div>
      </>
    }

    let operationPanel = <>
      <div>
        Once you finished, you can click the <strong>Submit</strong> button to see what the AI thinks.<br />
        <Button className="btn btn-primary btn-success" onClick={this.submitStatementFake} disabled={this.state.submitDisabled || this.isExampleSubmittable() === false}>Submit Statement</Button>
      </div>
      <div>
        If you find it too hard to fool the AI, we can click the <strong>Switch Passage</strong> button to switch to another Passage.<br />
        <Button className="btn btn-primary btn-success" onClick={this.switchContext} disabled={this.state.submitDisabled || this.state.chanceToSwitch <= 0}>Switch Passage</Button><br />
        You have <strong>{this.state.chanceToSwitch}</strong> chances remaining to switch the passage.
      </div>
    </>
    if (this.state.modelFooled) {
      operationPanel = <>
      <div style={{backgroundColor: '#EFDFD7', color: '#B52D0B'}}>
        <strong>Watch out !!!!</strong> <br />
        You are supposed to write a statement that is <strong>{targetLabelDesc}</strong>. <br />
        Please be sure to verify that your statement <strong>"{this.state.resData.statement}"</strong> is indeed <strong>{targetLabelDesc}</strong> given the passage.<br />
        Please <strong>Retract</strong> your statement if it is not.
        <br />
        <br />
        We will pass that example on to other humans for verification. If they tend to disagree with you, you will be <strong>flagged</strong> or even <strong>blocked</strong>. <br />
        <strong>Please do not submit the example before you are sure that the category is correct.</strong>
        <br />
        <br />
      </div>

      <div>
        If you think that your statement belongs to the right category and all your input is good, you can click the <strong>Finish</strong> button to finish the HIT.<br />
        <Button className="btn btn-primary btn-success" onClick={this.finishExample} disabled={this.isExampleSubmittable() === false}>Finish</Button>
      </div>

      <div>
        If you find that your made a mistake and your statement belongs to the wrong category, please click the <strong>Retract</strong> button below to retract your last input.<br />
        <Button className="btn btn-primary btn-success" onClick={this.retractExample}>Retract</Button><br />
      </div>
    </>
    }

    const tooShortNoticePanel = <div style={{color: "red"}}>At least 25 characters are required.</div>
    const statementShort = (this.state.resData.statement.trim().length <= 25) ? tooShortNoticePanel : <></>
    const LabelExpShort = (this.state.resData.labelExplanation.trim().length) <= 25 ? tooShortNoticePanel : <></>
    const ModelExpShort = (this.state.resData.modelExplanation.trim().length) <= 25 ? tooShortNoticePanel : <></>

    const collectionPanel = <>
      <div className="card">
      <div className="card-body">
        {/*<h5 className="card-title">Main Task</h5>*/}
      <div className="card-text">
      <strong>Passage:</strong>
        <div style={{color: "blue"}}>
        {this.state.reqData.passage}
        </div>

      <br/>
      Now, based on the <strong>passage</strong>, we would like you to
      <div className="card">
        <ul className="list-group list-group-flush">
            <li className="list-group-item"><strong>Write a statement that is <span style={{backgroundColor: "lightblue"}}>{targetLabelDesc}</span>:</strong><br />
                <input type="text" className="form-control" placeholder={`Write a statement that is ${targetLabelDesc}?`} onChange={this.handleStatementChange} disabled={this.state.modelFooled} value={this.state.resData.statement}/>
                {statementShort}
                (Please do not fool the models with typos or character replacements. The reasoning between the passage and the statement should be non-trivial.)
            </li>
            <li className="list-group-item"><strong>Explain why you think the statement is <span style={{backgroundColor: "lightblue"}}>{targetLabelDesc}</span>:</strong><br />
                <input type="text" className="form-control" placeholder={`Explain why you think the statement is ${targetLabelDesc}:`} onChange={this.handleLabelExpChange} value={this.state.resData.labelExplanation}/>
                {LabelExpShort}
            </li>
            <li className="list-group-item"><strong>Explain why you think the AI might get it wrong:</strong><br />
                <input type="text" className="form-control" placeholder={`Explain why you think the AI might get it wrong:`} onChange={this.handleModelExpChange} value={this.state.resData.modelExplanation}/>
                {ModelExpShort}
            </li>
        </ul>
      </div>
        <br />
        {modelFeedBack}
        <br />
        {feedBackDesc}
        <br />
        {operationPanel}
      </div>
      </div>
      </div>
    </>

    const topInstruction = <>
        <h1>Write sentences and fool the AI!</h1>
      </>

    let taskPreviewButton = <></>
    if (this.state.showPreview) {
      taskPreviewButton = <Button className="btn btn-info" onClick={() => {this.setState({showPreview: false})}}>Hide Task Preview</Button>
    } else {
      taskPreviewButton = <Button className="btn btn-info" onClick={() => {this.setState({showPreview: true})}}>Show Task Preview</Button>
    }

    const taskPreview = this.state.showPreview ? <>
      <p>You will be trying to <strong>beat an AI at a game</strong>. The AI is trying to understand English.
        </p>
        Given a <strong>passage</strong>, the AI must decide whether a <strong>statement</strong> is:<br />
        <ul>
          <li>Definitely correct; or</li>
          <li>Definitely incorrect; or</li>
          <li>Neither.</li>
        </ul>

        <p>In the game, you see a passage and a category. We would like you to write a statement that belongs to that category and to no other.<br />
        You should write your statements to trick the AI into picking the wrong category.<br />
        After you write your statement, we would also like you to explain:
          <ul>
            <li>Why your statement is definitely correct, definitely incorrect, or neither?</li>
            <li>Why you think the AI might get it wrong?</li>
          </ul>
        </p>
        <p>The AI will tell you what it thinks for each statement you write. Your goal is to fool the AI to pick the wrong category.
            For each passage, you will have multiple chances to write statements util you can fool the AI.</p>

        <p>
        <strong style={{color: "red"}}>Warning:</strong> Please do not spam the HITs, if other humans tend to disagree with your examples, you might be flagged or even blocked.
        </p>

        <p>
            The AI utilizes the latest technologies to understand language and can be very smart. Use your creativity fool the AI - it will be fun!!!
        </p>
      </> : <></>

    const bottomInstruction = <>
      <br />
      <p>
        For every successful statement, we will give your statement to other humans for verification. <br />
        If <strong>all</strong> of them agree <strong>(but the AI is fooled)</strong>, you will receive a <strong>bonus</strong>.<br />
        If you can keep providing good examples, your estimated total income will be <strong>DOUBLED</strong>.
        </p>

        <p>
        <strong style={{color: "red"}}>Warning:</strong> Please do not spam the HITs, if other humans tend to disagree with your inputs, you might be flagged and even blocked.
        </p>
        <hr />
      </>

    return (
      <Container>
        {topInstruction}
        {taskPreviewButton}
        {taskPreview}
        <hr />
        <ExampleGoodCards />
        <hr />
        {collectionPanel}
        {bottomInstruction}
      </Container>
    );
  }
}

export { NLIWritingInterface };
