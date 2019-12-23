import React, {PureComponent} from 'react';
import { connect } from 'dva';
import PageHeaderWrapper from '../../components/PageHeaderWrapper';
import {PlaybookTableView} from "../../components/Playbook";

@connect(({ deployTable }) => ({
    playbooks: deployTable.deployModelTable.playbooks
}))
export default class PlaybookListPage extends PureComponent {

    render() {
        const {playbooks} = this.props;
        return (
            <PageHeaderWrapper title="Playbooks">
                <PlaybookTableView playbooks={playbooks}/>
            </PageHeaderWrapper>
        );
    }
}