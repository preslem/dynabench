import React from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Nav,
  Table,
  Tooltip,
  OverlayTrigger,
} from 'react-bootstrap';
import { Link } from 'react-router-dom';
import UserContext from './UserContext';
import {
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Moment from 'react-moment';

class TaskMainPage extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return (
      <>
        <Col className="p-0" xs={12} sm={12} md={8} lg={10} xl={10}>
        <Card className="my-4">
          <Card.Header className="p-3 light-gray-bg">
            <h2 className="text-uppercase m-0 text-reset">Trend</h2>
          </Card.Header>
          <Card.Body className="p-3">
            {/* Mobile / Tablet / Desktop charts */}
            <Col xs={12} className="d-block d-sm-none">
              <Rechart size={chartSizes.xs} data={this.props.task.scores} />
            </Col>
            <Col sm={12} className="d-none d-sm-block d-md-none">
              <Rechart size={chartSizes.sm} data={this.props.task.scores} />
            </Col>
            <Col md={12} className="d-none d-md-block d-lg-none">
              <Rechart size={chartSizes.md} data={this.props.task.scores} />
            </Col>
            <Col lg={12} className="d-none d-lg-block d-xl-none">
              <Rechart size={chartSizes.lg} data={this.props.task.scores} />
            </Col>
            <Col xl={12} className="d-none d-xl-block">
              <Rechart size={chartSizes.xl} data={this.props.task.scores} />
            </Col>
          </Card.Body>
        </Card>
        </Col>
        <Card className="my-4">
          <Card.Header className="p-3 light-gray-bg">
            <h2 className="text-uppercase m-0 text-reset">Overall Model Leaderboard</h2>
          </Card.Header>
          <Card.Body className="p-0">
            <Table hover>
              <thead>
                <tr><th>Model</th><th>Mean accuracy</th></tr>
              </thead>
              <tbody>
                <tr><td><Link to="/models/1" className="btn-link">RoBERTa AllNLI</Link></td><td>89%</td></tr>
                <tr><td><Link to="/models/2" className="btn-link">XLNet AllNLI</Link></td><td>89%</td></tr>
              </tbody>
            </Table>
          </Card.Body>
        </Card>
        <Card className="my-4">
          <Card.Header className="p-3 light-gray-bg">
            <h2 className="text-uppercase m-0 text-reset">Overall User Leaderboard</h2>
          </Card.Header>
          <Card.Body className="p-0">
            <Table hover>
              <thead>
                <tr><th>Model</th><th>Mean MER</th><th>Total</th></tr>
              </thead>
              <tbody>
                <tr><td><Link to="/users/1" className="btn-link">Douwe</Link></td><td>7%</td><td>3410</td></tr>
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      </>
    );
  }
}

class TaskNav extends React.Component {
  render(props) {
    return (
      <Nav defaultActiveKey="#overall" className="flex-lg-column sidebar-wrapper sticky-top">
        <Nav.Item>
          <Nav.Link href="#overall" className="gray-color p-3 px-lg-5">Overall</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link href="#1" className="gray-color p-3 px-lg-5">Round 1</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link href="#2" className="gray-color p-3 px-lg-5">Round 2</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link href="#3" className="gray-color p-3 px-lg-5">Round 3</Nav.Link>
        </Nav.Item>
      </Nav>
    );
  }
}

class TaskPage extends React.Component {
  static contextType = UserContext;
  constructor(props) {
    super(props);
    this.state = {
      taskId: null,
      task: {
        scores: [
          {
            name: 0,
            data1: 30,
            data2: 23,
            data3: 22,
          },
          {
            name: 1,
            data1: 20,
            data2: 45,
            data3: 23,
          },
          {
            name: 2,
            data1: 50,
            data2: 56,
            data3: 21,
          },
          {
            name: 3,
            data1: 40,
            data2: 68,
            data3: 43,
          },
        ],
      },
    };
  }
  componentDidMount() {
    // const { match: { params } } = this.props;
    // this.setState(params, function() {
    //   this.context.api.getTask(this.state.taskId)
    //   .then(result => {
    //     console.log(result);
    //     this.setState({task: result});
    //   })
    //   .catch(error => {
    //     console.log(error);
    //   });
    // });
  }
  render() {
    function renderTooltip(props, text) {
      return (
        <Tooltip id="button-tooltip" {...props}>
          {text}
        </Tooltip>
      );
    }
    function renderCreateTooltip(props) {
      return renderTooltip(props, 'Create new examples where the model fails');
    }
    function renderVerifyTooltip(props) {
      return renderTooltip(
        props,
        'Verify examples where we think the model failed'
      );
    }
    function renderSubmitTooltip(props) {
      return renderTooltip(props, 'Submit model predictions on this task');
    }
    return (
      <Container fluid>
        <Row>
          <Col lg={2} className="p-0 border">
            <TaskNav task={this.state.task} />
          </Col>
          <Col lg={10} className="px-4 px-lg-5">
            <h2 className="task-page-header text-reset ml-0">{this.state.task.name}</h2>
            <p>{this.state.task.desc}</p>
            <Table className="w-50 font-weight-bold ml-n2">
              <thead />
              <tbody>
                <tr><td>Round:</td><td>{this.state.task.cur_round}</td></tr>
                <tr><td>Verified/Collected</td><td>{this.state.task.round?.total_verified}/{this.state.task.round?.total_collected}</td></tr>
                <tr><td>(Model error rate):</td><td>({this.state.task.round?.total_collected > 0 ? (this.state.task.round?.total_verified / this.state.task.round?.total_collected).toFixed(2) : '0.00'}%)</td></tr>
                <tr><td>Last update:</td><td><Moment utc fromNow>{this.state.task.last_updated}</Moment></td></tr>
              </tbody>
            </Table>
            <hr />
            <Nav className="my-4">
              <Nav.Item className="task-action-btn">
                <OverlayTrigger
                  placement="bottom"
                  delay={{ show: 250, hide: 400 }}
                  overlay={renderCreateTooltip}
                >
                  <Button
                    as={Link}
                    className="border-0 blue-color font-weight-bold light-gray-bg"
                    to={"/tasks/" + this.state.taskId + "/create"}
                  >
                    Create
                  </Button>
                </OverlayTrigger>
              </Nav.Item>
              <Nav.Item className="task-action-btn">
                <OverlayTrigger
                  placement="bottom"
                  delay={{ show: 250, hide: 400 }}
                  overlay={renderVerifyTooltip}
                >
                  <Button
                    as={Link}
                    className="border-0 blue-color font-weight-bold light-gray-bg"
                    to={"/tasks/" + this.state.taskId + "/verify"}
                  >
                    Verify
                  </Button>
                </OverlayTrigger>
              </Nav.Item>
              <Nav.Item className="task-action-btn">
                <OverlayTrigger
                  placement="bottom"
                  delay={{ show: 250, hide: 400 }}
                  overlay={renderSubmitTooltip}
                >
                  <Button
                    as={Link}
                    className="border-0 blue-color font-weight-bold light-gray-bg"
                    to={"/tasks/" + this.state.taskId + "/submit"}
                  >
                    Submit
                  </Button>
                </OverlayTrigger>
              </Nav.Item>
            </Nav>
            <TaskMainPage task={this.state.task} />
          </Col>
        </Row>
      </Container>
    );
  }
}

// Defaults for mobile
const Rechart = ({
  size: {
    align = 'center',
    fontSize = 10,
    height = 250,
    left = -40,
    legendAlign = null,
    right = 10,
    verticalAlign = 'bottom',
    width = '100%',
    xAxisLeftPadding = 25,
  },
  data,
}) => {
  const globalColors = ['#6fb98f', '#075756', '#66a5ad'];
  const dataset = Object.keys(data[0]).filter((item) => item != 'name');
  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart margin={{ left, right }} data={data}>
        <XAxis
          allowDecimals={false}
          dataKey="name"
          padding={{ left: xAxisLeftPadding }}
          tick={{ fontSize }}
          tickLine={false}
        />
        <YAxis
          interval="preserveStartEnd"
          tick={false}
          padding={{ top: 10 }}
          tick={{ fontSize }}
        />
        <ChartTooltip />
        <Legend
          align={align}
          layout={verticalAlign == 'top' ? 'vertical' : 'horizontal'}
          wrapperStyle={{
            fontSize,
            right: legendAlign,
          }}
          verticalAlign={verticalAlign}
        />
        {dataset.map((item, index) => (
          <Line
            dataKey={item}
            dot={{ fill: globalColors[index] }}
            stroke={globalColors[index]}
            strokeWidth={2}
            type="linear"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

const chartSizes = {
  xs: { fontSize: 10, legendAlign: -10 },
  sm: {
    align: 'center',
    fontSize: 14,
    height: 300,
    left: -30,
    xAxisLeftPadding: 50,
  },
  md: {
    align: 'right',
    fontSize: 14,
    height: 332,
    left: -20,
    legendAlign: -35,
    verticalAlign: 'top',
    width: '90%',
    xAxisLeftPadding: 50,
  },
  lg: {
    fontSize: 14,
    height: 492,
    left: -20,
    legendAlign: -35,
    width: "90%",
    verticalAlign: 'top',
    align: 'right',
    xAxisLeftPadding: 50,
  },
  xl: {
    align: 'right',
    fontSize: 14,
    height: 492,
    left: -20,
    legendAlign: -100,
    width: "80%",
    verticalAlign: 'top',
    xAxisLeftPadding: 50,
  },
};

export default TaskPage;
