import {PureComponent} from "react";
import * as PropTypes from "prop-types";
import React from "react";

import styles from "./index.less"

export class SimpleListView extends PureComponent {
    static propTypes = {
        dataSource: PropTypes.array,
        renderItem: PropTypes.func,
        rowKey: PropTypes.func,
        itemLayout: PropTypes.oneOf(["horizontal", "vertical"]),
        splitter: PropTypes.object
    };

    render() {
        let {dataSource = [], renderItem = r => r, rowKey = r => r, itemLayout = "vertical", splitter} = this.props;
        let uis = [];
        let i = 0;
        for (let record of dataSource) {
            let key = rowKey(record);
            if (uis.length > 0 && splitter) { // not the first element
                uis.push(<li>{splitter}</li>)
            }
            uis.push(
                <li key={key}>
                    {renderItem(record, i)}
                </li>
            );
            i++;
        }
        return (
            <ul className={styles["simple-list-view"] + ' ' + styles[itemLayout]}>
                {uis}
            </ul>
        )
    }
}