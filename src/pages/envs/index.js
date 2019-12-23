import React, {PureComponent} from 'react';
import { connect } from 'dva';
import PageHeaderWrapper from '../../components/PageHeaderWrapper';

import {EnvironmentTableView} from "../../components/Environment";

@connect(({ deployTable }) => ({
    envs: deployTable.deployModelTable.envs
}))
export default class EnvironmentListPage extends PureComponent {

    render() {
        const {envs} = this.props;

        return (
            <PageHeaderWrapper title="Environments">
                <EnvironmentTableView envs={envs}/>
            </PageHeaderWrapper>
        );
    }
}