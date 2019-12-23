import {Component} from "react";
import PageHeaderWrapper from '../../../components/PageHeaderWrapper';
import React from "react";
import { connect } from 'dva';
import {PlaybookGroupView} from "../../../components/Playbook";
import {Card} from "antd";

@connect(({ deployTable }) => ({
    playbooks: deployTable.deployModelTable.playbooks
}))
export default class PlaybookGroupDetailPage extends Component {
    render() {
        let {
            playbooks,
            match: { params: { name } }
        } = this.props;

        let playbookGroup = playbooks.getGroup(name);

        return (
            <PageHeaderWrapper title={`Playbook ${name}`}>
                <Card>
                    <PlaybookGroupView playbookGroup={playbookGroup} />
                </Card>
            </PageHeaderWrapper>
        )
    }
}