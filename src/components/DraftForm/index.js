import React, {Component} from "react";
import {connect} from "dva";
import {Icon, Spin} from "antd";
import {Link} from "umi";

@connect(({ deployTable }) => ({
    draft: deployTable.draft,
    submitting: deployTable.submitting
}))
export class DraftForm extends Component {

    renderContent() {
        let {draft, submitting} = this.props;

        if (submitting) {
            return <Spin indicator={<Icon type="loading" style={{ fontSize: 24 }} spin />}/>
        }
        if (!draft) {
            return <span/>;
        }

        return (
            <Link to="/commits/submit">Submit</Link>
        )
    }

    render() {
        return (
            <span style={{marginRight: "1em"}}>
                {this.renderContent()}
            </span>
        )
    }
}