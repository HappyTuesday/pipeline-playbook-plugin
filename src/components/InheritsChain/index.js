import React, {Component} from "react";
import * as PropTypes from 'prop-types'

import styles from './index.less'
import {Icon} from "antd";

export class InheritsChain extends Component {
    static propTypes = {
        self: PropTypes.object,
        parents: PropTypes.func,
        itemRender: PropTypes.func,
        itemKey: PropTypes.func
    };

    renderParents(s, close) {
        let {parents, itemKey = x => x, itemRender = x => itemKey(x)} = this.props;
        let lis = [];
        for (let p of parents(s)) {
            let key = itemKey(p);
            if (!close.has(key)) {
                close.add(key);
                lis.push(
                    <li key={key}>
                        <div className={styles["inherits-header"]}>
                            <span style={{marginRight: "0.5em"}}>
                                <Icon type="arrow-right"/>
                            </span>
                            {itemRender(p)}
                        </div>
                        {this.renderParents(p, close)}
                    </li>
                );
            }
        }

        if (lis.length > 0) {
            return (
                <ul className={styles["inherits-chain-parents"]}>{lis}</ul>
            )
        }
    }

    render() {
        let {self} = this.props;
        return (
            <div className={styles["inherits-chain"]}>
                {this.renderParents(self, new Set())}
            </div>
        )
    }
}