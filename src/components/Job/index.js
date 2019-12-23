import React, {Component} from 'react';
import {Card, Divider, Table, Tag} from 'antd';

import styles from './index.less';
import Search from "antd/es/input/Search";
import * as PropTypes from "prop-types";
import {VariableTable} from "../VariableTable";
import DescriptionList from "../../components/DescriptionList";
import Description from "../../components/DescriptionList/Description";
import {PlaybookLink, PlayInlineListView, TaskTagInlineListView} from "../Playbook";
import {Link} from "umi";
import {EnvironmentLink, HostInlineListView} from "../Environment";
import {Project} from "../../business/DeployModelTable";
import {ProjectLink} from "../Project";

export class JobLink extends Component {
    static propTypes = {
        job: PropTypes.object
    };

    render() {
        let {job} = this.props;
        let jobName = job instanceof Job ? job.jobName : job;
        return (<Link to={`/jobs/detail/${jobName}`}>{jobName}</Link>)
    }
}

export class UserParameterTableView extends Component {
    static propTypes = {
        parameters: PropTypes.array
    };

    columns = [
        {
            title: 'Name',
            dataIndex: 'parameterName'
        }, {
            title: 'Type',
            dataIndex: 'type'
        }, {
            title: 'Default Value',
            dataIndex: 'defaultValue'
        }, {
            title: 'Description',
            dataIndex: 'description'
        }, {
            title: 'Hidden',
            dataIndex: 'hidden'
        }, {
            title: 'Persistent',
            dataIndex: 'persistent'
        }, {
            title: 'Choices',
            dataIndex: 'choices'
        }, {
            title: 'Order',
            dataIndex: 'order'
        }, {
            title: 'Options',
            dataIndex: 'options'
        }
    ];

    render() {
        return (
            <Table
                size="middle"
                rowKey="parameterName"
                pagination={false}
                dataSource={this.props.parameters}
                columns={this.columns}
            />
        )
    }
}

export class JobView extends Component {
    static propTypes = {
        job: PropTypes.object
    };

    render() {
        let {job} = this.props;
        job.initialize();
        return (
            <div>
                <DescriptionList>
                    <Description term="Environment">
                        <EnvironmentLink env={job.env}/>
                    </Description>
                    <Description term="Playbook">
                        <PlaybookLink playbook={job.playbook}/>
                    </Description>
                    <Description term="Group">{job.groupName}</Description>
                    <Description term="Section Name">{job.sectionName}</Description>
                    <Description term="Job Order">{job.jobOrder}</Description>
                    <Description term="Schedule">
                        <span style={{fontWeight: "bold"}}>{job.schedule}</span>
                    </Description>
                </DescriptionList>
                <Divider />
                {job.dependencies && job.dependencies.length > 0 && (
                    <p>
                        <label>Dependencies: </label>
                        {
                            job.dependencies.map(d => <Tag color="cyan">{d}</Tag>)
                        }
                    </p>
                )}
                {job.containerLabels && job.containerLabels.length > 0 && (
                    <p>
                        <label>Container Labels: </label>
                        {
                            job.containerLabels.map(l => <Tag color="gold">{l}</Tag>)
                        }
                    </p>
                )}
                {job.gitRepositoryUrl && (
                    <p>
                        <label>Git Repository URL: </label>
                        <a href={job.gitRepositoryUrl} target="_blank">{job.gitRepositoryUrl}</a>
                    </p>
                )}
                {job.defaultBranchName && (
                    <p>
                        <label>Default Branch Name: </label>
                        {job.defaultBranchName}
                    </p>
                )}
                <p>
                    <label>Active Plays:</label>
                    <PlayInlineListView plays={job.plays}/>
                </p>
                <p>
                    <label>All Plays:</label>
                    <PlayInlineListView plays={job.allPlays}/>
                </p>
                <p>
                    <label>Task Tags:</label>
                    <TaskTagInlineListView plays={job.tasks}/>
                </p>
                {job.tasksToSkip && job.tasksToSkip.length > 0 && (
                    <p>
                        <label>Tasks to Skip:</label>
                        <TaskTagInlineListView plays={job.tasksToSkip}/>
                    </p>
                )}
                {job.servers && job.servers.length > 0 && (
                    <p>
                        <label>Servers:</label>
                        <HostInlineListView plays={job.servers}/>
                    </p>
                )}
                <Divider />
                <p>
                    <label>User Parameters</label>
                    <UserParameterTableView parameters={job.userParameters}/>
                </p>
                <VariableTable selfVariables={job.vars} variables={job.cascadeVars} resolver={job.resolver}/>
            </div>
        )
    }
}

export class JobTableView extends Component {

    static propTypes = {
        jobs: PropTypes.object
    };

    state = {
        searchKey: ""
    };

    columns = [
        {
            title: 'Job Name',
            dataIndex: 'jobName',
            render: jobName => <JobLink job={jobName}/>,
        }, {
            title: 'Environment',
            dataIndex: 'env',
            render: env => <EnvironmentLink env={env}/>
        }, {
            title: 'Project',
            dataIndex: 'project',
            render: project => <ProjectLink project={project}/>
        }, {
            title: 'Playbook',
            dataIndex: 'playbook',
            render: playbook => <PlaybookLink playbook={playbook}/>
        }, {
            title: 'Section',
            dataIndex: 'sectionName'
        }, {
            title: 'Job Order',
            dataIndex: 'jobOrder'
        }
    ];

    render() {
        const {jobs} = this.props;

        const extraContent = (
            <div>
                <Search
                    className={styles.extraContentSearch}
                    placeholder="search..."
                    onChange={e => this.setState({searchKey: e.target.value})}
                    onSearch={key => this.setState({searchKey: key})}
                    style={{width: "200px", marginLeft: "16px"}}
                    defaultValue={this.state.searchKey}
                />
            </div>
        );
        const searchSpec = {
            searchKey: this.state.searchKey
        };
        return (
            <Card bordered={true} extra={extraContent}>
                <Table
                    size="middle"
                    rowKey="jobName"
                    pagination={{pageSize: 50}}
                    dataSource={jobs.search(searchSpec)}
                    columns={this.columns}
                    onRow={record => record.initialize()}
                />
            </Card>
        );
    }
}