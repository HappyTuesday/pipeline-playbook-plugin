import React, {Component} from 'react';
import {Card, Divider, Radio, Table, Tabs, Icon, List} from 'antd';

import styles from './index.less';
import Search from "antd/es/input/Search";
import * as PropTypes from "prop-types";
import {ClosureView, VariableTable} from "../VariableTable";
import {SimpleListView} from "../SimpleListView";
import DescriptionList from "../../components/DescriptionList";
import Description from "../../components/DescriptionList/Description";
import {InheritsChain} from "../InheritsChain";
import {PlaybookLink, PlaybookView} from "../Playbook";
import {Link} from "umi";
import {EnvironmentLink} from "../Environment";
import {Project} from "../../business/DeployModelTable";
import {AssignmentScope} from "../../business/DeployRecordTable";

const RadioGroup = Radio.Group;
const RadioButton = Radio.Button;
const { TabPane } = Tabs;

export class ProjectLink extends Component {
    static propTypes = {
        project: PropTypes.object
    };

    render() {
        let {project} = this.props;
        let projectName = project instanceof Project ? project.projectName : project;
        return (<Link to={`/projects/detail/${projectName}`}>{projectName}</Link>)
    }
}

class ProjectOverrideView extends Component {
    static propTypes = {
        projectOverride: PropTypes.object,
        onAssignment: PropTypes.func
    };

    onAssignment = assign => {
        let {projectOverride: po, onAssignment} = this.props;
        onAssignment(assign.update({
            envName: po.query.toString,
            projectName: po.project.projectName,
            scope: AssignmentScope.project
        }));
    };

    render() {
        let {projectOverride: po} = this.props;

        return (
            <div>
                <VariableTable
                    selfVariables={po.vars}
                    variables={po.cascadeVars}
                    onAssignment={this.onAssignment}
                />
                {po.playbook && (
                    <Card title={<span>Playbook <PlaybookLink playbook={po.playbook}/></span>} style={{marginTop: "1em"}}>
                        <PlaybookView playbook={po.playbook}/>
                    </Card>
                )}
            </div>
        )
    }
}

class ProjectOverrideListView extends Component {
    static propTypes = {
        project: PropTypes.object,
        onAssignment: PropTypes.func
    };

    render() {
        let {project, onAssignment} = this.props;
        return (
            <div>
                <h2 style={{marginTop: "2em"}}>Overrides</h2>
                <Tabs >
                    {project.overrides.map(po =>
                        <TabPane tab={
                            <span>
                                {po.inherited ? <Icon type="layout" /> : <Icon type="folder" />}
                                {po.title}
                            </span>
                        } key={po.title}>
                            <h3>{po.title}</h3>
                            <ProjectOverrideView projectOverride={po} onAssignment={onAssignment}/>
                        </TabPane>
                    )}
                </Tabs>
            </div>
        )
    }
}

export class ProjectView extends Component {
    static propTypes = {
        project: PropTypes.object,
        onAssignment: PropTypes.func
    };

    onAssignment = assign => {
        let {project, onAssignment} = this.props;
        onAssignment(assign.update({
            projectName: project.projectName,
            scope: AssignmentScope.project
        }));
    };

    render() {
        let {project, onAssignment} = this.props;

        let sharing = [];
        if (project.sharing && project.sharing.size > 0) {
            for (let [key, value] of project.sharing) {
                sharing.push(<p><label>{key} -> </label><EnvironmentLink env={value}/></p>)
            }
        }

        return (
            <div>
                <DescriptionList size="small">
                    <Description term="Abstracted">{project.abstracted ? 'yes' : 'no'}</Description>
                    <Description term="Name Key">{project.key}</Description>
                    <Description term="Include In Env">{project.includedInEnv && project.includedInEnv.join(',')}</Description>
                    <Description term="Include Only In Env">{project.includedOnlyInEnv && project.includedOnlyInEnv.join(',')}</Description>
                    <Description term="Exclude In Env">{project.excludedInEnv && project.excludedInEnv.join(',')}</Description>
                    <Description term="Active In Env">
                        <EnvironmentLink env={project.activeInEnv}/>
                    </Description>
                    <Description term="Playbook">
                        {project.playbookName && <PlaybookLink playbook={project.playbookName}/>}
                    </Description>
                    <Description term="When">
                        <SimpleListView
                            dataSource={project.when}
                            rowKey={c => c.groovy}
                            itemLayout="horizontal"
                            renderItem={c => (<ClosureView closure={c}/>)}
                        />
                    </Description>
                    <Description term="Project Name Generator">
                        <ClosureView closure={project.projectNameGenerator}/>
                    </Description>
                    <Description term="Variable Group Generator">
                        <ClosureView closure={project.variableGroupGenerator}/>
                    </Description>
                    <Description term="Description">{project.description}</Description>
                </DescriptionList>
                <Divider />
                {sharing.length > 0 && (
                    <p>
                        {sharing}
                        <Divider/>
                    </p>
                )}
                <p>
                    <h4>Inherits</h4>
                    <InheritsChain
                        self={project}
                        parents={p => p.parents}
                        itemKey={p => p.projectName}
                        itemRender={p => <ProjectLink project={p}/>}
                    />
                </p>
                <VariableTable
                    selfVariables={project.vars}
                    variables={project.cascadeVars}
                    onAssignment={this.onAssignment}
                />
                {project.playbook &&
                    <Card title={<span>Playbook <PlaybookLink playbook={project.playbook}/></span>}
                          style={{marginTop: "1em"}}>
                        <PlaybookView playbook={project.playbook}/>
                    </Card>
                }
                <ProjectOverrideListView project={project} onAssignment={onAssignment}/>
            </div>
        )
    }
}

export class ProjectTableView extends Component {

    static propTypes = {
        projects: PropTypes.object
    };

    state = {
        searchKey: "",
        abstractMode: "concrete"
    };

    columns = [
        {
            title: 'Project Name',
            dataIndex: 'projectName',
            render: projectName => <ProjectLink project={projectName}/>,
        }, {
            title: 'Playbook',
            dataIndex: 'playbookName'
        }, {
            title: 'Active In Env',
            dataIndex: 'activeInEnv.name',
            render: env => <EnvironmentLink env={env}/>
        }, {
            title: 'Included Only In Env',
            dataIndex: 'includedOnlyInEnv',
            render: list => (<span>{list && list.join(',')}</span>)
        }, {
            title: 'Description',
            dataIndex: 'description'
        }
    ];

    render() {
        const {projects} = this.props;

        const abstractModeButton = mode => (
            <RadioButton value={mode} onClick={() => this.setState({abstractMode: mode})}>{mode}</RadioButton>
        );

        const extraContent = (
            <div>
                <RadioGroup defaultValue={this.state.abstractMode}>
                    {abstractModeButton("concrete")}
                    {abstractModeButton("abstracted")}
                </RadioGroup>
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
            searchKey: this.state.searchKey,
            abstractMode: this.state.abstractMode
        };
        return (
            <Card bordered={true} extra={extraContent}>
                <Table
                    size="middle"
                    rowKey="projectName"
                    pagination={{pageSize: 50}}
                    dataSource={projects.search(searchSpec)}
                    columns={this.columns}
                />
            </Card>
        );
    }
}