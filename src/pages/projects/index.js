import React, {PureComponent} from 'react';
import { connect } from 'dva';
import PageHeaderWrapper from '../../components/PageHeaderWrapper';
import {ProjectTableView} from "../../components/Project";

@connect(({ deployTable }) => ({
    projects: deployTable.deployModelTable.projects
}))
export default class ProjectListPage extends PureComponent {
    render() {
        const {projects} = this.props;
        return (
            <PageHeaderWrapper title="Projects">
                <ProjectTableView projects={projects}/>
            </PageHeaderWrapper>
        );
    }
}