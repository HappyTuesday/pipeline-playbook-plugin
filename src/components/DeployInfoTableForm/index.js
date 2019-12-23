import React, {Component, Fragment} from "react";
import {connect} from "dva";
import {Button, Icon, Select} from "antd";

@connect(({ deployTable }) => ({
    targetBranch: deployTable.targetBranch,
    allBranches: deployTable.allBranches
}))
export class DeployInfoTableForm extends Component {

    componentDidMount() {
        let {dispatch} = this.props;
        dispatch({
            type: 'deployTable/fetchBranches'
        })
    }

    onSelect = targetBranch => {
        let {dispatch} = this.props;
        dispatch({
            type: "deployTable/updateTargetBranch",
            payload: targetBranch
        });
        dispatch({
            type: "deployTable/fetchDeployTable",
            payload: targetBranch
        });
    };

    onRefresh = () => {
        let {dispatch, targetBranch} = this.props;
        dispatch({
            type: 'deployTable/fetchBranches'
        });
        dispatch({
            type: "deployTable/fetchDeployTable",
            payload: targetBranch
        });
    };

    render() {
        let {targetBranch, allBranches} = this.props;
        return (
            <span style={{marginRight: "1em"}}>
                <Select
                    placeholder="Select a branch"
                    value={targetBranch}
                    onSelect={this.onSelect}
                    loading={!allBranches}
                    style={{minWidth: "5em"}}
                >
                    {allBranches && allBranches.map(b => (
                        <Select.Option value={b.name}>{b.name}</Select.Option>)
                    )}
                </Select>
                <a onClick={this.onRefresh} style={{marginLeft: "0.4em"}}>
                    <Icon type="redo"/>
                </a>
            </span>
        )
    }
}