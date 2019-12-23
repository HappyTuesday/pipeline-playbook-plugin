import React, {Component} from "react";
import * as PropTypes from "prop-types";
import {Avatar, Button, Icon, Input, List, Table, Tag} from 'antd'
import {SimpleListView} from "../SimpleListView";
import {ClosureView,VariableWrapperView} from "../VariableTable";
import {EnvironmentLink} from "../Environment";
import {PlaybookLink} from "../Playbook";
import DescriptionList from "../DescriptionList";

import styles from './index.less'
import {SimpleVariables} from "../../business/Variables";
import {Commit} from "../../business/DeployRecordTable";
import {Link} from "umi";
import Description from "../DescriptionList/Description";

export class CommitLink extends Component {
    static propTypes = {
        commit: PropTypes.object
    };

    render() {
        let {commit} = this.props;
        let commitId = commit instanceof Commit ? commit.id : commit;
        return (<Link to={`/commits/detail/${commitId}`}>#{commitId}</Link>)
    }
}

export class CommitView extends Component{
    static propTypes = {
        commit: PropTypes.object
    };

    render() {
        let {commit} = this.props;
        return (
            <div>
                <p>
                    <label>Author: </label>
                    <span>{commit.author}</span>
                </p>
                <p>
                    <label>Time: </label>
                    <span>{new Date(commit.timestamp).toLocaleDateString()}</span>
                </p>
                <p>{commit.comment}</p>
                {commit.parentId && (
                    <p>
                        <label>Parent: </label>
                        <CommitLink commit={commit.parentId}/>
                    </p>
                )}
            </div>
        )
    }
}

export class DeployRecordSummaryView extends Component {
    static propTypes = {
        deployRecord: PropTypes.object
    };

    render() {
        let {deployRecord: {envs, projects, assigns, hosts, hostGroups}} = this.props;

        let spans = [];
        if (envs && envs.length > 0) {
            spans.push(
                <span><b>{envs.length}</b> environment[s]</span>
            )
        }
        if (projects && projects.length > 0) {
            spans.push(
                <span><b>{projects.length}</b> project[s]</span>
            )
        }
        if (hosts && hosts.length > 0) {
            spans.push(
                <span><b>{hosts.length}</b> host[s]</span>
            )
        }
        if (hostGroups && hostGroups.length > 0) {
            spans.push(
                <span><b>{hostGroups.length}</b> host group[s]</span>
            )
        }
        if (assigns && assigns.length > 0) {
            spans.push(
                <span><b>{assigns.length}</b> assign[s]</span>
            )
        }

        for (let i = 1; i < spans.length; i++) {
            if (i === spans.length - 1) {
                spans.splice(i, 0, <span> and </span>)
            } else {
                spans.splice(i, 0, <span>, </span>)
            }
            i++;
        }

        return (
            <span>
                Includes <span>{spans}</span>
            </span>
        )
    }
}

export class DeployRecordSubmitVoiew extends Component{
    static propTypes = {
        deployRecord: PropTypes.object,
        onSubmit: PropTypes.func
    };

    state = {
        comment: ''
    };

    onSubmit = () => {
        let {comment} = this.state;
        let {deployRecord, onSubmit} = this.props;
        deployRecord.commit.comment = comment;
        onSubmit(deployRecord);
    };

    render() {
        let {deployRecord} = this.props;
        return (
            <div>
                <p>
                    <DeployRecordSummaryView deployRecord={deployRecord}/>
                </p>
                <p>
                    <Input.TextArea
                        defaultValue={this.state.comment}
                        onChange={e => this.setState({comment: e.target.value})}
                    />
                </p>
                <p>
                    <Button onClick={this.onSubmit}>Submit</Button>
                </p>
            </div>
        )
    }
}

export class EnvironmentRecordListView extends Component {
    static propTypes = {
        records: PropTypes.array
    };

    columns = [
        {
            title: 'Name',
            dataIndex: 'name'
        }, {
            title: 'Abstracted',
            dataIndex: 'abstracted',
            render: v => v ? 'yes' : 'no',
        }, {
            title: 'Disabled',
            dataIndex: 'disabled',
            render: v => v ? 'yes' : 'no',
        }, {
            title: 'Parents',
            dataIndex: 'parents',
            render: parents => parents && parents.map(l => <Tag color="blue">{l}</Tag>)
        }, {
            title: 'Labels',
            dataIndex: 'labels',
            render: labels => labels && labels.map(l => <Tag color="blue">{l}</Tag>)
        }
    ];

    render() {
        return (
            <Table
                size="middle"
                rowKey="name"
                pagination={false}
                dataSource={this.props.records}
                columns={this.columns}
            />
        )
    }
}

export class HostGroupRecordListView extends Component {
    static propTypes = {
        records: PropTypes.array
    };

    columns = [
        {
            title: 'Env',
            dataIndex: 'env'
        }, {
            title: 'Name',
            dataIndex: 'name'
        }, {
            title: 'Override',
            dataIndex: 'override',
            render: v => v ? 'yes' : 'no',
        }, {
            title: 'Disabled',
            dataIndex: 'disabled',
            render: v => v ? 'yes' : 'no',
        }, {
            title: 'Hosts',
            dataIndex: 'hosts',
            render: v => v && v.join(', ')
        }, {
            title: 'Inherits',
            dataIndex: 'inherits',
            render: v => v && v.join(', ')
        }, {
            title: 'Inherits Retired',
            dataIndex: 'inheritsRetired',
            render: v => v && v.join(', ')
        }
    ];

    render() {
        return (
            <Table
                size="middle"
                rowKey="name"
                pagination={false}
                dataSource={this.props.records}
                columns={this.columns}
            />
        )
    }
}

export class HostRecordListView extends Component {
    static propTypes = {
        records: PropTypes.array
    };

    columns = [
        {
            title: 'Env',
            dataIndex: 'env'
        }, {
            title: 'Name',
            dataIndex: 'name'
        }, {
            title: 'User',
            dataIndex: 'user'
        }, {
            title: 'Port',
            dataIndex: 'port'
        }, {
            title: 'Channel',
            dataIndex: 'channel'
        }, {
            title: 'Retired',
            dataIndex: 'retired',
            render: v => v ? 'yes' : 'no',
        }, {
            title: 'Disabled',
            dataIndex: 'disabled',
            render: v => v ? 'yes' : 'no',
        }
    ];

    render() {
        return (
            <Table
                size="middle"
                rowKey="name"
                pagination={false}
                dataSource={this.props.records}
                columns={this.columns}
            />
        )
    }
}

export class ProjectRecordView extends Component {
    static propTypes = {
        record: PropTypes.object
    };

    render() {
        let {record} = this.props;

        return (
            <DescriptionList size="small">
                <Description term="Abstracted">{record.abstracted ? 'yes' : 'no'}</Description>
                <Description term="Disabled">{record.disabled ? 'yes' : 'no'}</Description>
                <Description term="Name Key">{record.key}</Description>
                <Description term="Include In Env">{record.includedInEnv && project.includedInEnv.join(',')}</Description>
                <Description term="Include Only In Env">{record.includedOnlyInEnv && project.includedOnlyInEnv.join(',')}</Description>
                <Description term="Exclude In Env">{record.excludedInEnv && project.excludedInEnv.join(',')}</Description>
                <Description term="Active In Env">
                    <EnvironmentLink env={record.activeInEnv}/>
                </Description>
                <Description term="Playbook">
                    {record.playbookName && <PlaybookLink playbook={project.playbookName}/>}
                </Description>
                {record.when && (
                    <Description term="When">
                        <SimpleListView
                            dataSource={record.when}
                            rowKey={c => c.groovy}
                            itemLayout="horizontal"
                            renderItem={c => (<ClosureView closure={c}/>)}
                        />
                    </Description>
                )}
                <Description term="Project Name Generator">
                    <ClosureView closure={record.projectNameGenerator}/>
                </Description>
                <Description term="Parents">
                    {record.parents && record.parents.map(l => <Tag color="blue">{l}</Tag>)}
                </Description>
            </DescriptionList>
        )
    }
}

export class ProjectRecordListView extends Component {
    static propTypes = {
        records: PropTypes.array
    };

    render() {
        return (
            <SimpleListView
                dataSource={this.props.records}
                rowKey={r => r.projectName}
                renderItem={r => <ProjectRecordView record={r}/>}
            />
        )
    }
}

export class AssignmentListView extends Component {
    static propTypes = {
        assigns: PropTypes.array
    };

    columns = [
        {
            title: 'Name',
            dataIndex: 'variableInfo.name',
            width: '10em',
            render: (name, assign) => (
                <label className={(assign.disabled ? styles.disabled : '') + styles["variable-name"]}>{name}</label>
            )
        }, {
            title: 'Scope',
            dataIndex: 'scope',
            width: '5em',
        }, {
            title: 'Env',
            dataIndex: 'envName',
            width: '5em',
        }, {
            title: 'Project',
            dataIndex: 'projectName',
            width: '5em',
        }, {
            title: 'Variable',
            dataIndex: 'variableInfo',
            render: info => {
                let variables = new SimpleVariables([info], 'assign');
                let variable = variables.variables().toArray()[0];
                return (
                    <VariableWrapperView variable={variable} variables={variables}/>
                )
            }
        }
    ];

    render() {
        return (
            <Table
                size="middle"
                rowKey="variableInfo.name"
                pagination={false}
                dataSource={this.props.assigns}
                columns={this.columns}
            />
        )
    }
}

export class DeployRecordView extends Component {
    static propTypes = {
        deployRecord: PropTypes.object
    };

    render() {
        let {deployRecord: {
            commit,
            envs,
            projects,
            assigns,
            hosts,
            hostGroups
        }} = this.props;

        return (
            <div>
                <CommitView commit={commit}/>
                {envs && envs.length > 0 && (
                    <p>
                        <h3>Envs</h3>
                        <EnvironmentRecordListView records={envs}/>
                    </p>
                )}
                {hosts && hosts.length > 0 && (
                    <p>
                        <h3>Hosts</h3>
                        <HostRecordListView records={hosts}/>
                    </p>
                )}
                {hostGroups && hostGroups.length > 0 && (
                    <p>
                        <h3>Host Groups</h3>
                        <HostGroupRecordListView records={hostGroups}/>
                    </p>
                )}
                {projects && projects.length > 0 && (
                    <p>
                        <h3>Projects</h3>
                        <ProjectRecordListView records={projects}/>
                    </p>
                )}
                {assigns && assigns.length > 0 && (
                    <p>
                        <h3>Assigns</h3>
                        <AssignmentListView assigns={assigns}/>
                    </p>
                )}
            </div>
        )
    }
}

export class CommitListView extends Component {
    static propTypes = {
        deployRecords: PropTypes.array,
        loading: PropTypes.bool,
        loadingMore: PropTypes.bool
    };

    render() {
        let {deployRecords, loading, loadingMore} = this.props;

        return (
            <List
                dataSource={deployRecords}
                itemLayout="vertical"
                size="large"
                loading={loading}
                loadMore={loadingMore && <a onClick={loadingMore}>Loading More</a>}
                renderItem={r => (
                    <List.Item
                        key={r.commit.id}
                        actions={[
                            <Icon type="star-o"/>,
                            <Icon type="like-o" />
                        ]}
                    >
                        <List.Item.Meta
                            title={(
                                <span>
                                    <CommitLink commit={r.commit.id}/>
                                    @{r.commit.author}
                                </span>
                            )}
                            avatar={<Avatar icon="contacts"/>}
                            description={r.commit.comment}
                        />
                        <DeployRecordSummaryView deployRecord={r}/>
                    </List.Item>
                )}
            />
        )
    }
}

export class CommitMergeView {
    static propTypes = {
        deployRecord: PropTypes.array
    };

    render() {

    }
}