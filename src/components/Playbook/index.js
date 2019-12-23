import React, {Component} from 'react';
import {
    Card, Checkbox, Divider,
    Table, Tag, Tabs,
} from 'antd';

import styles from './index.less';
import Search from "antd/es/input/Search";
import {SimpleListView} from "../../components/SimpleListView";
import * as PropTypes from "prop-types";
import {LayeredVariables} from "../../business/Variables";
import DescriptionList from "../../components/DescriptionList";
import Description from "../../components/DescriptionList/Description";
import {ClosureView, VariableTable} from "../VariableTable";
import {InheritsChain} from "../InheritsChain";
import {uniqueAdd} from "../../functions/collection";
import {Link} from "umi";
import {EnvironmentLink} from "../Environment";
import {Playbook} from "../../business/DeployModelTable";

export class PlaybookLink extends Component {
    static propTypes = {
        playbook: PropTypes.object
    };

    render() {
        let {playbook} = this.props;
        let name = playbook instanceof Playbook ? playbook.name : playbook;
        return (<Link to={`/playbooks/detail/${name}`}>{name}</Link>)
    }
}

class TaskView extends Component {
    static propTypes = {
        task: PropTypes.object,
        taskNamePrefix: PropTypes.string
    };

    render() {
        let {taskNamePrefix, task} = this.props;
        let title = (
            <span>
                <span style={{marginRight: "1em"}}>{taskNamePrefix} {task.name}</span>
                {task.tags.map(t => (<Tag color="green">{t}</Tag>))}
            </span>
        );
        return (
            <Card title={title} bordered={true} style={{marginBottom: "0.5em"}}>
                {task.when && task.when.length > 0 && (
                    <p>
                        <h4>Executed when </h4>
                        <SimpleListView
                            dataSource={task.when}
                            rowKey={c => c.text}
                            renderItem={c => (<ClosureView closure={c}/>)}
                        />
                    </p>
                )}
                <p>
                    {task.includedOnlyInEnv && (
                        <span>
                            <label>Include only in env </label><span>[{task.includedOnlyInEnv}]</span>.
                        </span>
                    )}
                    {task.excludedInEnv && (
                        <span>
                            <label>Excluded in env </label><span>[{task.excludedInEnv}]</span>.
                        </span>
                    )}
                    {task.onlyRetiredHosts && (
                        <span>
                            <label>Executed only on retired hosts</label>.
                        </span>
                    )}
                    {task.includeRetiredHosts && (
                        <span>
                            <label>Allowed executed on retired hosts</label>.
                        </span>
                    )}
                </p>
                <p>
                    {task.retries > 0 && (
                        <span>
                            <label>Retries </label><span>{task.retries}</span> times after failure.
                        </span>
                    )}
                    {task.resourcesRequired && task.resourcesRequired.length > 0 && (
                        <span>
                            <label>Require Resources</label>
                            <span>[{task.resourcesRequired}]</span>.
                        </span>
                    )}
                    {task.reverse && (
                        <span>
                            <label>Executed in reverse sequence.</label>
                        </span>
                    )}
                </p>
                <p>
                    {task.closure && task.closure.groovy ?
                        (<ClosureView closure={task.closure} bordered={true} braces={false}/>) :
                        (<span>No task closure defined</span>)
                    }
                </p>
                {!task.children.empty && (
                    <p>
                        <h4>Nested Tasks:</h4>
                        <TaskListView taskList={task.children} taskNamePrefix={taskNamePrefix}/>
                    </p>
                )}
            </Card>
        )
    }
}

class TaskListView extends Component {
    static propTypes = {
        taskList: PropTypes.object,
        taskNamePrefix: PropTypes.string
    };

    render() {
        let {taskList, taskNamePrefix} = this.props;
        return (
            <SimpleListView
                dataSource={taskList.search()}
                renderItem={(t, i) => (<TaskView task={t} taskNamePrefix={taskNamePrefix + (i + 1) + '.'}/>)}
            />
        )
    }
}

class PlayView extends Component {
    static propTypes = {
        play: PropTypes.object,
        playbook: PropTypes.object
    };

    render() {
        let {play, playbook} = this.props;
        let vars = new LayeredVariables("execute play " + play.name, [playbook.activeInEnv.vars, playbook.vars, play.vars]);
        return (
            <div>
                <DescriptionList size="small" title="Basic Info">
                    <Description term="Serial">{play.serial}</Description>
                    <Description term="When">
                        <ClosureView closure={play.when} inline={true}/>
                    </Description>
                    <Description term="Include Only In Env">{play.includedOnlyInEnv}</Description>
                    <Description term="Exclude In Env">{play.excludedInEnv}</Description>
                    <Description term="Retries">{play.retries}</Description>
                    <Description term="Always Run">{play.alwaysRun}</Description>
                    <Description term="Resources Required">{play.resourcesRequired}</Description>
                    <Description term="Description">{play.description}</Description>
                </DescriptionList>
                <Divider />
                <VariableTable
                    selfVariables={play.vars}
                    variables={vars}
                />
                <Divider />
                <TaskListView taskList={play.tasks} taskNamePrefix="Task #"/>
            </div>
        )
    }
}

class PlayListView extends Component {
    static propTypes = {
        plays: PropTypes.array,
        playbook: PropTypes.object
    };

    render() {
        let {plays, playbook} = this.props;
        return (
            <Tabs tabPosition="left">
                {plays.map(p => (
                    <Tabs.TabPane key={p.name} tab={p.name}>
                        <h3>Play {p.name}</h3>
                        <PlayView play={p} playbook={playbook}/>
                    </Tabs.TabPane>
                ))}
            </Tabs>
        )
    }
}

export class PlayInlineListView extends Component {
    static propTypes = {
        plays: PropTypes.array
    };

    render() {
        return (
            <SimpleListView
                dataSource={this.props.plays}
                itemLayout="horizontal"
                renderItem={p => (
                    <span style={{marginLeft: "0.5em"}}>{p}</span>
                )}
            />
        )
    }
}

export class TaskInlineListView extends Component {
    static propTypes = {
        tasks: PropTypes.array
    };

    render() {
        return (
            <SimpleListView
                dataSource={this.props.tasks}
                itemLayout="horizontal"
                renderItem={p => (
                    <span style={{marginLeft: "0.5em"}}>{p}</span>
                )}
            />
        )
    }
}

export class TaskTagInlineListView extends Component {
    static propTypes = {
        tags: PropTypes.array
    };

    render() {
        return (
            <SimpleListView
                dataSource={this.props.tags}
                itemLayout="horizontal"
                renderItem={p => (
                    <Tag color="blue" style={{marginLeft: "0.5em"}}>{p}</Tag>
                )}
            />
        )
    }
}

class PlaybookParameterSpecView extends Component {
    static propTypes = {
        spec: PropTypes.object
    };

    render() {
        let {spec}= this.props;
        if (spec.allowedValues) {
            if (spec.allowedValues.length === 1) {
                return '=' + spec.allowedValues[0];
            } else {
                let list = (
                    <SimpleListView
                        dataSource={spec.allowedValues}
                        itemLayout="horizontal"
                        splitter=", "
                    />
                );
                return (<span>in [{list}]</span>);
            }
        } else {
            return (<span>exists</span>);
        }
    }
}

class PlaybookParameterSpecListView extends Component {
    static propTypes = {
        specs: PropTypes.array
    };

    render() {
        let {specs} = this.props;
        return (
            <SimpleListView
                dataSource={specs}
                rowKey={s => s.name}
                renderItem={spec => (
                    <span>
                        <label>{spec.name}</label>
                        <PlaybookParameterSpecView spec={spec}/>
                    </span>
                )}
            />
        )
    }
}

class PlaybookSceneView extends Component {
    static propTypes = {
        scene: PropTypes.object
    };

    render() {
        let {scene} = this.props;
        return (
            <div>
                <h3>Scene {scene.name}</h3>
                <p>
                    <label>Plays: </label>
                    <PlayInlineListView plays={scene.plays}/>
                </p>
                {scene.tasksToSkip.length > 0 && (
                    <p>
                        <label>Tasks to Skip</label>
                        <TaskInlineListView tasks={scene.tasksToSkip}/>
                    </p>
                )}
            </div>
        )
    }
}

class PlaybookSceneListView extends Component {
    static propTypes = {
        scenes: PropTypes.array
    };

    render() {
        let {scenes} = this.props;
        return (
            <SimpleListView dataSource={scenes} renderItem={s => (<PlaybookSceneView scene={s}/>)}/>
        )
    }
}

export class PlaybookView extends Component {
    static propTypes = {
        playbook: PropTypes.object
    };

    render() {
        let {playbook} = this.props;
        return (
            <div>
                {playbook.description && (
                    <p>{playbook.description}</p>
                )}
                {playbook.parameterSpecs.size > 0 && (
                    <p>
                        <label>Parameter Specs</label>
                        <PlaybookParameterSpecListView specs={Array.from(playbook.parameterSpecs.values())} />
                    </p>
                )}
                <p>
                    <label>Inherits</label>
                    <InheritsChain
                        self={playbook.name}
                        parents={s => playbook.infoMap.get(s).parents.filter(p => playbook.infoMap.get(p).matchParameters(playbook.parameterSpecs))}
                        itemRender={s => <PlaybookLink playbook={s}/>}
                    />
                </p>
                <p>
                    <label>Active in Env:</label> <span>{<EnvironmentLink env={playbook.activeInEnv}/>}</span>
                </p>
                {playbook.scenes.size > 0 && (
                    <p>
                        <h4>Scenes</h4>
                        <PlaybookSceneListView scenes={Array.from(playbook.scenes.values())}/>
                    </p>
                )}
                <VariableTable selfVariables={playbook.vars} variables={playbook.cascadeVars}/>
                <Divider/>
                <p>
                    <h4>Plays</h4>
                    <PlayListView plays={Array.from(playbook.plays.values())} playbook={playbook}/>
                </p>
            </div>
        )
    }
}

class PlaybookParameterSpecsSelector extends Component {
    static propTypes = {
        playbookName: PropTypes.string,
        specsMap: PropTypes.object,
        onChange: PropTypes.func
    };

    state = {
        selected: new Map() // parameter name -> playbook names
    };

    onChange(checked, name, playbooks) {
        let {playbookName, specsMap, onChange} = this.props;
        let {selected} = this.state;
        if (checked) {
            if (selected.has(name)) {
                let ps = Array.from(selected.get(name));
                uniqueAdd(ps, playbooks);
                selected.set(name, ps);
            } else {
                selected.set(name, playbooks);
            }
        } else if (selected.has(name)) {
            let ps = selected.get(name).filter(p => !playbooks.includes(p));
            if (ps.length > 0) {
                selected.set(name, ps);
            } else {
                selected.delete(name);
            }
        } else {
            // the selected key is already deleted
        }

        let map = new Map();
        for (let [name, specs] of specsMap) {
            let spec;
            for (let s of specs) {
                // 1. the spec belongs to current playbook
                // 2. the spec is selected
                if (s.playbooks.includes(playbookName) ||
                    selected.has(name) && selected.get(name).some(p => s.playbooks.includes(p))) {

                    if (spec) {
                        spec = spec.intersect(s.spec);
                    } else {
                        spec = s.spec;
                    }
                }
            }

            if (spec) {
                map.set(name, spec);
            }
        }

        onChange(map);
    };

    renderCheckbox(name, s) {
        let {playbookName} = this.props;
        let extra = {};
        if (s.playbooks.includes(playbookName)) {
            extra = {
                defaultChecked: true,
                disabled: true
            }
        }

        return (
            <Checkbox onChange={e => this.onChange(e.target.checked, name, s.playbooks)} {...extra}>
                <span title={`for playbooks ${s.playbooks}`}>
                    <PlaybookParameterSpecView spec={s.spec}/>
                </span>
            </Checkbox>
        )
    }

    render() {
        let {specsMap} = this.props;
        return (
            <SimpleListView
                dataSource={specsMap}
                renderItem={([name, specs]) => (
                    <div>
                        <label>{name}</label>
                        <SimpleListView
                            dataSource={specs}
                            renderItem={s => this.renderCheckbox(name, s)}
                            itemLayout="horizontal"
                            splitter={<Divider type="horizontal"/>}
                        />
                    </div>
                )}
            />
        )
    }
}

export class PlaybookGroupView extends Component {

    static propTypes = {
        playbookGroup: PropTypes.object
    };

    state = {
        parameterSpecs: null
    };

    onParameterSpecsChange = specsMap => {
        this.setState({parameterSpecs: specsMap});
    };

    render() {
        let {playbookGroup} = this.props;
        let {parameterSpecs} = this.state;
        let playbook = parameterSpecs ? playbookGroup.getOrCreate(parameterSpecs) : playbookGroup.defaults;

        return (
            <div>
                <PlaybookParameterSpecsSelector
                    playbookName={playbookGroup.name}
                    specsMap={playbookGroup.parameterSpecs}
                    onChange={this.onParameterSpecsChange}
                />
                <Divider/>
                <PlaybookView playbook={playbook}/>
            </div>
        )
    }
}

export class PlaybookTableView extends Component {

    static propTypes = {
        playbooks: PropTypes.object
    };

    state = {
        searchKey: ""
    };

    columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            render: name => <PlaybookLink playbook={name}/>,
        }, {
            title: 'Parameters',
            dataIndex: 'parameterSpecs',
            render: specs => (<SimpleListView dataSource={specs.keys()}/>)
        }, {
            title: 'Description',
            dataIndex: 'defaults.description'
        }, {
            title: 'Default Scene',
            children: [
                {
                    title: 'Plays',
                    dataIndex: "defaults",
                    render: playbook => {
                        let scene = playbook.getDefaultScene();
                        if (scene) {
                            return <PlayInlineListView plays={scene.plays}/>;
                        } else {
                            return null;
                        }
                    }
                }, {
                    title: 'Tasks to Skip',
                    dataIndex: "defaults",
                    render: playbook => {
                        let scene = playbook.getDefaultScene();
                        if (scene) {
                            return <TaskInlineListView tasks={scene.tasksToSkip}/>;
                        } else {
                            return null;
                        }
                    }
                }
            ]
        }
    ];

    render() {
        const {
            playbooks
        } = this.props;

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
        const searchSpec = {
            searchKey: this.state.searchKey
        };
        return (
            <Card bordered={true} extra={extraContent}>
                <Table
                    size="middle"
                    rowKey="name"
                    pagination={{pageSize: 50}}
                    dataSource={playbooks.search(searchSpec)}
                    columns={this.columns}
                />
            </Card>
        );
    }
}