import React, {PureComponent} from 'react';
import { connect } from 'dva';
import PageHeaderWrapper from '../../components/PageHeaderWrapper';
import {JobTableView} from "../../components/Job";

@connect(({ deployTable }) => ({
    jobs: deployTable.deployModelTable.jobs
}))
export default class JobListPage extends PureComponent {
    render() {
        const {jobs} = this.props;
        return (
            <PageHeaderWrapper title="Jobs">
                <JobTableView jobs={jobs}/>
            </PageHeaderWrapper>
        );
    }
}