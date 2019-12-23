import React, {Component} from 'react';
import {
    Card,
    Button,
    Radio,
    Table, Tag, Divider, List, Icon, Avatar, Popover
} from 'antd';

import styles from './index.less';
import Search from "antd/es/input/Search";
import * as PropTypes from "prop-types";
import {InheritsChain} from "../InheritsChain";
import {VariableTable} from "../VariableTable";
import DescriptionList from "../../components/DescriptionList";
import Description from "../../components/DescriptionList/Description";
import {Link} from "umi";
import {Environment} from "../../business/DeployModelTable";
import {SimpleListView} from "../SimpleListView";

const RadioGroup = Radio.Group;
const RadioButton = Radio.Button;

export class EnvironmentLink extends Component {
    static propTypes = {
        env: PropTypes.object
    };

    render() {
        let {env} = this.props;
        let envName = env instanceof Environment ? env.name : env;
        return (<Link to={`/envs/detail/${envName}`}>{envName}</Link>)
    }
}

class HostView extends Component {
    static propTypes= {
        host: PropTypes.object,
        collapsed: PropTypes.bool
    };

    renderBody() {
        let {host} = this.props;
        let labels = [];
        for (let [k, v] of host.labels) {
            labels.push(<Tag color="green">{k}={v}</Tag>)
        }
        return (
            <div>
                <p><label>User:</label>{host.user}</p>
                <p><label>Port:</label>{host.port}</p>
                <p><label>Channel:</label>{host.channel}</p>
                <p><label>Labels:</label>{labels}</p>
                <p><label>Description:</label>{host.description}</p>
            </div>
        )
    }

    render() {

        let {host, collapsed} = this.props;
        let title = <span style={host.retired && {textDecoration: 'line-through'}}>{host.name}</span>;
        if (collapsed) {
            return (
                <Popover title={`Host ${host.name}`} content={this.renderBody()} trigger="click">
                    <a className={styles["host-link"]} title={host.description}>
                        {title}
                    </a>
                </Popover>
            )
        }

        return (
            <div>
                <Card hoverable className={styles.card} size="small">
                    <Card.Meta
                        title={title}
                        description={this.renderBody()}
                    />
                </Card>
            </div>
        );
    }
}

export class HostInlineListView extends Component {
    static propTypes = {
        hosts: PropTypes.array
    };

    render() {
        return (
            <SimpleListView
                dataSource={this.props.hosts}
                itemLayout="horizontal"
                renderItem={h => (
                    <span style={{marginLeft: "0.5em"}}>{h}</span>
                )}
            />
        )
    }
}

class HostTableView extends Component {
    static propTypes = {
        hosts: PropTypes.object,
    };

    state = {
        searchKey: ""
    };

    render() {

        const extraContent = (
            <div>
                <Search
                    className={styles.extraContentSearch}
                    placeholder="search..."
                    onChange={e => this.setState({searchKey: e.target.value})}
                    onSearch={key => this.setState({searchKey: key})}
                    style={{width: "200px", marginLeft: "16px"}}
                    defaultValue={this.state.searchKey}
                />
            </div>
        );

        let {hosts} = this.props;
        let {searchKey} = this.state;

        return (
            <Card bordered={true} extra={extraContent} title={`Hosts`}>
                <List
                    rowKey="name"
                    size="small"
                    itemLayout="horizontal"
                    dataSource={hosts.search({searchKey})}
                    grid={{ gutter: 6, lg: 6, md: 4, sm: 3, xs: 2 }}
                    renderItem={item => (
                        <List.Item>
                            <HostView host={item}/>
                        </List.Item>
                    )}
                    pagination={{pageSize: 6, hideOnSinglePage: true}}
                />
            </Card>
        )
    }
}

class HostGroupView extends Component {

    static propTypes = {
        hostGroup: PropTypes.object
    };

    renderHostGroupLink = hg => {
        return (
            <Popover content={<HostGroupView hostGroup={hg}/>} title={`Host Group ${hg.name}`} trigger="click">
                <a className={styles["host-group-link"]}>{hg.name}</a>
            </Popover>
        )
    };

    render() {
        let {hostGroup} = this.props;

        let basic = (
            <div>
                {hostGroup.description && (
                    <desc>{hostGroup.description}</desc>
                )}
                {hostGroup.override && (
                    <p>
                        <span>Override previous settings.</span>
                    </p>
                )}
                {hostGroup.inherits.length > 0 && (
                    <p>
                        <InheritsChain
                            self={hostGroup}
                            parents={hg => hg.inherits}
                            itemKey={hg => hg.name}
                            itemRender={this.renderHostGroupLink}
                        />
                    </p>
                )}
                {hostGroup.inheritsRetired.length > 0 && (
                    <p>
                        <label>Inherits Retired from</label>
                        <InheritsChain
                            self={hostGroup}
                            parents={hg => hg.inheritsRetired}
                            itemKey={hg => hg.name}
                            itemRender={this.renderHostGroupLink}
                        />
                    </p>
                )}
            </div>
        );

        let detail;
        if (hostGroup.hosts.length > 0) {
            detail = (
                <div>
                    <label>Hosts</label>
                    <List
                        rowKey="name"
                        size="small"
                        itemLayout="horizontal"
                        dataSource={hostGroup.hosts}
                        grid={{ gutter: 6, lg: 6, md: 4, sm: 3, xs: 2 }}
                        renderItem={item => (
                            <List.Item>
                                <HostView host={item} collapsed={true}/>
                            </List.Item>
                        )}
                        pagination={{pageSize: 12, hideOnSinglePage: true, simple: true}}
                    />
                </div>
            )
        } else {
            detail = <span>No hosts defined in host group {hostGroup.name}</span>
        }

        return (
            <div>
                {basic}
                {detail}
            </div>
        );
    }
}

class HostGroupTableView extends Component {
    static propTypes = {
        hostGroups: PropTypes.object
    };

    state = {
        searchKey: ""
    };

    onSearch = (searchKey) => {
        this.setState({searchKey});
    };

    render() {

        const extraContent = (
            <div>
                <Search
                    className={styles.extraContentSearch}
                    placeholder="search..."
                    onChange={e => this.onSearch(e.target.value)}
                    onSearch={key => this.onSearch(key)}
                    style={{width: "200px", marginLeft: "16px"}}
                    defaultValue={this.state.searchKey}
                />
            </div>
        );

        let {hostGroups} = this.props;
        let {searchKey} = this.state;

        return (
            <Card bordered={true} extra={extraContent} title={`Host Groups`}>
                <List
                    dataSource={hostGroups.search({searchKey})}
                    rowKey="name"
                    renderItem={hg => (
                        <List.Item key={hg.name}>
                            <List.Item.Meta title={hg.name} avatar={<Avatar icon="hdd"/>} description={
                                <HostGroupView hostGroup={hg}/>
                            }/>
                        </List.Item>
                    )}
                    pagination={{pageSize: 6, hideOnSinglePage: true}}
                />
            </Card>
        )
    }
}

export class EnvironmentView extends Component {

    static propTypes = {
        env: PropTypes.object,
        onAssignment: PropTypes.func
    };

    onAssignment = assign => {
        let {env, onAssignment} = this.props;
        onAssignment(assign.update({envName: env.rootEnv ? null : env.name}));
    };

    render() {
        const {env} = this.props;

        return (
            <div>
                <DescriptionList size="large" title="Summary" style={{ marginBottom: 32 }}>
                    <Description term="Abstracted">{env.abstracted ? 'yes' : 'no'}</Description>
                    <Description term="Labels">
                        {<SimpleListView
                            dataSource={env.labels}
                            renderItem={l => <Tag color="blue">{l}</Tag>}
                            itemLayout="horizontal"
                        />}
                    </Description>
                    <Description term="Description">{env.description}</Description>
                </DescriptionList>
                <Divider style={{ marginBottom: 32 }} />
                <div>
                    <h3>Inherits</h3>
                    <InheritsChain
                        self={env}
                        parents={e => e.parents}
                        itemKey={e => e.name}
                        itemRender={e => (<EnvironmentLink env={e}/>)}
                    />
                </div>

                <Divider style={{ marginBottom: 32 }} />
                <VariableTable
                    selfVariables={env.vars}
                    variables={env.cascadeVars}
                    onAssignment={this.onAssignment}
                />

                <Divider style={{ marginBottom: 32 }} />
                <HostTableView hosts={env.hosts} />

                <Divider style={{ marginBottom: 32 }} />
                <HostGroupTableView hostGroups={env.hostGroups} />
            </div>
        )
    }
}

export class EnvironmentTableView extends Component {

    static propTypes = {
        envs: PropTypes.object
    };

    state = {
        searchKey: "",
        abstractMode: "concrete"
    };

    columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            render: name => <EnvironmentLink env={name}/>,
        }, {
            title: 'Description',
            dataIndex: 'description'
        }, {
            title: 'Hosts',
            dataIndex: 'hosts',
            render: hosts => hosts.size()
        }, {
            title: 'Host Groups',
            dataIndex: 'hostGroups',
            render: hostGroups => hostGroups.size()
        }, {
            title: 'Labels',
            dataIndex: 'labels',
            render: labels => (
                <SimpleListView
                    dataSource={labels}
                    itemLayout="horizontal"
                    renderItem={l => <Tag color="blue">{l}</Tag>}
                />
            )
        }
    ];

    render() {
        const {envs} = this.props;

        const abstractModeButton = mode => (
            <RadioButton value={mode} onClick={() => this.setState({abstractMode: mode})}>{mode}</RadioButton>
        );

        const extraContent = (
            <div>
                <RadioGroup defaultValue={this.state.abstractMode}>
                    {abstractModeButton("concrete")}
                    {abstractModeButton("abstracted")}
                </RadioGroup>
                <Search
                    className={styles.extraContentSearch}
                    placeholder="search..."
                    onChange={e => this.setState({searchKey: e.target.value})}
                    onSearch={key => this.setState({searchKey: key})}
                    style={{width: "200px", marginLeft: "16px"}}
                    defaultValue={this.state.searchKey}
                />
            </div>
        );
        const addEnvButton = (
            <Button icon="plus" type="primary" onClick={() => navigateTo("/envs/create")}>
                New Environment
            </Button>
        );
        const searchSpec = {
            searchKey: this.state.searchKey,
            abstractMode: this.state.abstractMode
        };
        return (
            <Card bordered={true} extra={extraContent} title={addEnvButton}>
                <Table
                    size="middle"
                    rowKey="name"
                    pagination={{pageSize: 50}}
                    dataSource={envs.search(searchSpec)}
                    columns={this.columns}
                />
            </Card>
        );
    }
}