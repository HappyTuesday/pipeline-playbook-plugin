import {Component} from "react";
import PageHeaderWrapper from '../../../components/PageHeaderWrapper';
import React from "react";
import { connect } from 'dva';
import {Card} from "antd";
import {JobView} from "../../../components/Job";

@connect(({ deployTable }) => ({
    jobs: deployTable.deployModelTable.jobs
}))
export default class JobDetailPage extends Component {

    render() {
        let {
            jobs,
            match: { params: { name } }
        } = this.props;

        let job = jobs.getByJobName(name);
        return (
            <PageHeaderWrapper title={`Job ${name}`}>
                <Card>
                    <JobView job={job}/>
                </Card>
            </PageHeaderWrapper>
        )
    }
}