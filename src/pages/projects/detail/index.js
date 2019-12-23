import {Component} from "react";
import PageHeaderWrapper from '../../../components/PageHeaderWrapper';
import React from "react";
import { connect } from 'dva';
import {ProjectView} from "../../../components/Project";
import {Card} from "antd";

@connect(({ deployTable }) => ({
    projects: deployTable.deployModelTable.projects
}))
export default class ProjectDetailPage extends Component {

    onAssignment = assign => {
        let {dispatch} = this.props;
        dispatch({
            type: "deployTable/updateDraft",
            payload: {
                record: assign,
                operator: 'addAssign'
            }
        })
    };

    render() {
        let {
            projects,
            match: { params: { name } }
        } = this.props;

        let project = projects.get(name);
        return (
            <PageHeaderWrapper title={`Project ${name}`}>
                <Card>
                    <ProjectView project={project} onAssignment={this.onAssignment}/>
                </Card>
            </PageHeaderWrapper>
        )
    }
}