import {Component, Fragment} from "react";
import * as PropTypes from "prop-types";
import {
    Card,
    Icon,
    Popover,
    Radio,
    Table,
    Input,
    Tooltip,
    AutoComplete,
    Select,
    Button,
    Modal,
    Steps
} from "antd";
import {LayeredVariables} from "../../business/Variables";
import React from "react";
import Search from "antd/es/input/Search";
const Step = Steps.Step;

import styles from "./index.less"
import {
    CascadeListVariable,
    CascadeMapVariable, ContextualVariable,
    Variable,
    VariableInfo,
    VariableTypeList
} from "../../business/Variable"
import {Assignment} from "../../business/DeployRecordTable";
import {parseClosure} from "../../services/api";
import {Closure} from "../../business/Closure";

export class GroovyEditor extends Component {

    static propTypes = {
        groovy: PropTypes.string,
        error: PropTypes.string,
        onChange: PropTypes.func
    };

    render() {
        let {groovy, error, onChange} = this.props;
        let textarea = (
            <Input.TextArea
                placeholder="input groovy here"
                autosize={true}
                defaultValue={groovy}
                autoFocus={true}
                onChange={e => onChange(e.target.value)}
                className={styles["groovy-editor"] + (error ? ' ' + styles.error : '')}
            />
        );
        if (error) {
            return (
                <Tooltip title={<span className={styles["groovy-editor-error-info"]}>{error}</span>} placement="topRight">
                    {textarea}
                </Tooltip>
            )
        } else {
            return textarea;
        }
    }
}

export class GroovyViewer extends Component {
    static propTypes = {
        groovy: PropTypes.string
    };

    render() {
        let {groovy} = this.props;
        return <pre className={styles["groovy-viewer"]}>{groovy}</pre>
    }
}

export class ClosureView extends Component {

    static ParsedClosures = new Map();

    static Parsing = false;

    static propTypes = {
        closure: PropTypes.object,
        bordered: PropTypes.bool,
        braces: PropTypes.bool,
        onChange: PropTypes.func,
        readonly: PropTypes.bool
    };

    onChange(text) {
        let {onChange} = this.props;
        let groovy = '{' + text + '}';
        let parsed = ClosureView.ParsedClosures.get(groovy);
        if (parsed) {
            onChange(new Closure(parsed));
            return;
        }

        if (ClosureView.Parsing) {
            return;
        }

        ClosureView.Parsing = true;

        parseClosure(groovy).then(closure => {
            ClosureView.ParsedClosures.set(groovy, closure);
            onChange(new Closure(closure));
        }).finally(() => {
            ClosureView.Parsing = false;
        });
    }

    render() {
        let {closure, bordered, braces = true, readonly = true} = this.props;
        if (closure) {
            let body = closure.body || '';
            let inline = false;
            if (readonly && !body.includes('\n')) {
                inline = true;
            }
            let ui;
            if (readonly) {
                ui = <GroovyViewer groovy={body}/>
            } else {
                ui = <GroovyEditor groovy={body} error={closure.serverOnly} onChange={text => this.onChange(text)}/>
            }
            let bodyClasses = [styles["groovy-body"]];
            if (inline) {
                bodyClasses.push(styles.inline);
            }
            if (bordered) {
                bodyClasses.push(styles.bordered);
            }
            return (
                <div className={styles["closure-view"] + ' ' + (braces ? styles.braces : '')}>
                    {braces && (<span className={styles["grammar-char"]}>{"{"}</span>)}
                    <div className={bodyClasses.join(' ')}>{ui}</div>
                    {braces && (<span className={styles["grammar-char"]}>{"}"}</span>)}
                </div>
            )
        } else {
            return (
                <span>
                    <label className={styles["variable-type"]}>null</label>
                </span>
            )
        }
    }
}

export class VariableView extends Component {
    static propTypes = {
        variable: PropTypes.object,
        onChange: PropTypes.func,
        onDelete: PropTypes.func,
        extraProps: PropTypes.object
    };

    onWrap(type) {
        let {variable, onChange} = this.props;
        onChange(variable, type.wrap(variable));
    }

    renderWrapperSelector() {
        let {variable} = this.props;
        let types = VariableTypeList.filter(t => t.canWrap && t.canWrap(variable));
        if (types.length === 0) {
            return;
        }

        let select = types.map(t => (
            <p>
                <a onClick={() => this.onWrap(t)}>
                    <Icon type="right" theme="filled" /> {t.desc}
                </a>
            </p>
        ));

        return (
            <Popover title="Wrap to" content={select} trigger="click" placement="rightTop">
                <a title="change variable type"><Icon type="form"/></a>
            </Popover>
        )
    }

    onDelete = () => {
        let {variable, onDelete} = this.props;
        onDelete(variable);
    };

    onMouseEnter = e => {
        let {variable, extraProps} = this.props;
        let {currentActive, onFocus} = extraProps;
        onFocus(variable);
        if (variable === currentActive) {
            e.preventDefault();
        }
    };

    onMouseLeave = e => {
    };

    render() {
        let {variable, onChange, onDelete, extraProps = {}} = this.props;
        let {editing, currentActive, cascaded} = extraProps;
        let viewRender = VariableViews[variable.type] || VariableViews.unknown;
        let view = viewRender(variable, onChange, extraProps);
        let operators = [];
        let mouseListeners = {};
        if (editing && !cascaded) {
            let selector = this.renderWrapperSelector();
            if (selector) {
                operators.push(selector);
            }
            if (onDelete) {
                operators.push(
                    <a title="delete variable" onClick={this.onDelete}><Icon type="delete"/></a>
                );
            }

            mouseListeners = {
                onMouseEnter: this.onMouseEnter,
                onMouseLeave: this.onMouseLeave
            }
        }

        let content = (
            <div className={styles.variable} {...mouseListeners}>
                {view}
            </div>
        );

        if (currentActive && currentActive.info === variable.info && operators.length > 0) {
            return (
                <Tooltip title={<span>{operators}</span>} placement="leftTop" defaultVisible={true}>
                    {content}
                </Tooltip>
            )
        } else {
            return content;
        }
    }
}

export class VariableNameSelector extends Component {

    static propTypes = {
        variables: PropTypes.object,
        name: PropTypes.string,
        onChange: PropTypes.func,
        maxOptions: PropTypes.number
    };

    match(input, name) {
        if (!input) {
            return true;
        }
        if (name.toLowerCase().includes(input.toLowerCase())) {
            return true;
        }
        let as = input.split('.');
        let bs = name.split('.');
        let i = 0;
        for (let a of as) {
            let found = false;
            for (; i < bs.length; i++) {
                if (bs[i].toLowerCase().includes(a.toLowerCase())) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                return false;
            }
        }
        return true;
    }

    filterOption = (inputValue, option) => {
        return this.match(inputValue, option.key);
    };

    /**
     * prepare up to maxOptions options, using random
     */
    prepareOptions() {
        let {variables, name, maxOptions = 20} = this.props;
        let names = variables.variables()
            .map(v => v.info.name)
            .filter(n => this.match(name, n))
            .toArray();
        if (names.length <= maxOptions) {
            return names;
        }
        let rate = maxOptions / names.length;
        let result = [];
        for (let i = 0; i < names.length; i++) {
            if (result.length >= maxOptions) {
                return result;
            } else if (names.length - i + result.length <= maxOptions) {
                result.push(...names.slice(i));
                return result;
            } else if (Math.random() <= rate) {
                result.push(names[i]);
            }
        }
        return result;
    }

    render() {
        let {name, onChange} = this.props;

        return (
            <AutoComplete
                defaultValue={name}
                dataSource={this.prepareOptions()}
                filterOption={this.filterOption}
                onChange={onChange}
                autoFocus={true}
                style={{width: "100%"}}
            />
        )
    }
}

export class CreateVariableModal extends Component {
    static propTypes = {
        variables: PropTypes.object,
        selectName: PropTypes.bool,
        inputName: PropTypes.bool,
        onCreate: PropTypes.func,
        renderTrigger: PropTypes.func
    };

    state = {
        visible: false,
        selectedName: '',
        enteredName: '',
        draft: null,
        currentActive: null,
        currentStep: 0
    };

    onSelectType = (type) => {
        let {selectName, inputName} = this.props;
        let {selectedName, enteredName} = this.state;
        if (selectName && !selectedName || inputName && !enteredName) {
            return;
        }
        if (!type) {
            return;
        }
        let name;
        if (selectName) {
            name = selectedName;
        } else if (inputName) {
            name = enteredName;
        }
        this.setState({
            draft: Variable.toVariable(type.createEmpty(name)),
            currentStep: this.state.currentStep + 2
        });
    };

    onChange(info) {
        this.setState({draft: Variable.toVariable(info)});
    }

    renderForm() {
        let {selectName, inputName, variables} = this.props;
        let {selectedName, enteredName, draft, currentActive, currentStep} = this.state;

        let steps = [];

        if (selectName) {
            steps.push(
                <Step title="Name" description={(
                    <VariableNameSelector
                        variables={variables}
                        name={selectedName}
                        onChange={text => this.setState({
                            selectedName: text,
                            currentStep: this.state.currentStep + 1
                        })}
                    />
                )}/>
            )
        } else if (inputName) {
            steps.push(
                <Step title="Name" description={(
                    <Input
                        onChange={e => this.setState({
                            enteredName: e.target.value,
                            currentStep: this.state.currentStep + 1
                        })}
                        defaultValue={enteredName}
                    />
                )}/>
            )
        }

        steps.push(
            <Step title="Type" description={(
                <Select style={{width: "100%"}} onSelect={this.onSelectType}>
                    {VariableTypeList.filter(t => t.createEmpty).map(t => (
                        <Select.Option value={t}>{t.desc}</Select.Option>
                    ))}
                </Select>
            )}/>
        );

        steps.push(
            <Step title="Value" description={draft && (
                <div style={{margin: "0 1px"}}>
                    <VariableView
                        variable={draft}
                        onChange={(from, to) => this.onChange(to)}
                        extraProps={{
                            editing: true,
                            currentActive,
                            variables,
                            onFocus: v => this.setState({currentActive: v})
                        }}
                    />
                </div>
            )}/>
        );

        return (
            <Steps direction="vertical" current={currentStep}>
                {steps}
            </Steps>
        )
    }

    onShow = () => {
        this.setState({visible: true});
    };

    onClose = () => {
        this.setState({
            visible: false,
            selectedName: '',
            enteredName: '',
            draft: null,
            currentActive: null,
            currentStep: 0
        });
    };

    onOk = () => {
        let {onCreate} = this.props;
        let {draft} = this.state;
        this.onClose();
        if (draft) {
            onCreate(draft.info);
        }
    };

    render() {
        let {renderTrigger} = this.props;
        let {visible} = this.state;
        return (
            <Fragment>
                {renderTrigger(this.onShow)}
                <Modal align={{}}
                       title="Create Variable"
                       visible={visible}
                       destroyOnClose={true}
                       onCancel={this.onClose}
                       onOk={this.onOk}>

                    {this.renderForm()}
                </Modal>
            </Fragment>
        )
    }
}

export class SimpleVariableView extends Component {

    static propTypes = {
        variable: PropTypes.object,
        onChange: PropTypes.func,
        extraProps: PropTypes.object
    };

    correctType(text) {
        let {variable: {value}} = this.props;
        switch (typeof value) {
            case "string":
                return text;
            case "number":
                return Number.parseFloat(text);
            default:
                return JSON.parse(text);
        }
    }

    onChange(text) {
        let {variable, onChange} = this.props;
        let newValue = this.correctType(text);
        onChange(variable, variable.info.update({value: newValue}));
    }

    renderEditing() {
        let {variable} = this.props;
        let text;
        if (typeof variable.value === "string") {
            text = variable.value;
        } else {
            text = JSON.stringify(variable.value);
        }
        return (
            <Input.TextArea
                placeholder="input value here"
                autosize={true}
                defaultValue={text}
                autoFocus={true}
                onChange={e => this.onChange(e.target.value)}
            />
        )
    }

    render() {
        let {variable, extraProps} = this.props;
        let {editing} = extraProps;

        if (editing) {
            return this.renderEditing();
        }

        if (variable.value === null || variable.value === undefined) {
            return (
                <span className={styles["simple-variable"]}>
                    <label className={styles["variable-type"]}>null</label>
                </span>
            )
        } else {
            let text;
            if (typeof variable.value === "string") {
                text = variable.value;
            } else {
                text = JSON.stringify(variable.value);
            }
            if (!text) {
                return (
                    <span className={styles["simple-variable"]}>
                        <label className={styles["variable-type"]}>empty</label>
                    </span>
                )
            }
            return (
                <pre className={styles["simple-variable"]} title={typeof variable.value}>
                    {text}
                </pre>
            )
        }
    }
}

export class ListVariableView extends Component {

    static propTypes = {
        variable: PropTypes.object,
        onChange: PropTypes.func,
        extraProps: PropTypes.object
    };

    applyChange(list) {
        let {variable, onChange} = this.props;
        onChange(variable, variable.info.update({list: list}));
    }

    onItemChange = (from, to) => {
        this.applyChange(this.props.variable.info.list.map(i => i === from.info ? to : i));
    };

    onItemDelete = v => {
        this.applyChange(this.props.variable.info.list.filter(i => i !== v.info));
    };

    onAdd = info => {
        let {variable} = this.props;
        if (variable instanceof CascadeListVariable) {
            info = info.update({name: variable.info.name + '.' + variable.info.list.length});
        }
        this.applyChange([...variable.info.list, info])
    };

    render() {
        let {variable, extraProps} = this.props;
        let {editing, variables} = extraProps;

        let list = variable.getRawList(extraProps.variables);
        let lis = list.map(({variable: v, cascaded}) =>
            <li key={v.info.name} className={styles["list-variable-item"]}>
                <VariableView
                    variable={v}
                    onChange={this.onItemChange}
                    onDelete={this.onItemDelete}
                    extraProps={{...extraProps, editing: editing && !cascaded}}
                />
            </li>
        );

        if (editing) {
            lis.push(
                <li key="add" className={styles["list-variable-item"]}>
                    <CreateVariableModal
                        variables={variables}
                        onCreate={this.onAdd}
                        renderTrigger={onShow => (
                            <a onClick={onShow}><Icon type="plus" /></a>
                        )}
                    />
                </li>
            )
        }

        return (
            <div className={styles["list-variable"]}>
                <span className={styles["grammar-char"]}>[</span>
                {lis.length > 0 && <ul className={styles["list-variable-list"]}>{lis}</ul>}
                <span className={styles["grammar-char"]}>]</span>
            </div>
        )
    }
}

export class MapVariableView extends Component {

    static propTypes = {
        variable: PropTypes.object,
        onChange: PropTypes.func,
        extraProps: PropTypes.object
    };

    applyChange($map) {
        let {variable, onChange} = this.props;
        onChange(variable, variable.info.update({$map: $map}));
    }

    onItemChange(key, to) {
        let m =new Map(this.props.variable.info.$map);
        m.set(key, to);
        this.applyChange(m);
    }

    onItemDelete(key) {
        let m = new Map(this.props.variable.info.$map);
        m.delete(key);
        this.applyChange(m);
    }

    onAdd = info => {
        let key = info.name;
        let {variable} = this.props;
        if (variable instanceof CascadeMapVariable) {
            info = info.update({name: variable.info.name + '.' + key})
        } else {
            info = info.update({name: null});
        }
        let m = new Map(variable.info.$map);
        m.set(key, info);
        this.applyChange(m)
    };

    render() {
        let {variable, extraProps} = this.props;
        let {editing, variables} = extraProps;

        let lis = [];
        for (let {key, variable: v, cascaded} of variable.getRawMap(extraProps.variables)) {
            let label;
            if (key !== "*") {
                label = (
                    <div>
                        <label className={styles["map-variable-key"]}>{key}</label>
                        <label className={styles["grammar-char"]}>:</label>
                    </div>
                )
            }

            lis.push(
                <li key={key}>
                    {label}
                    <VariableView
                        variable={v}
                        onChange={(from, to) => this.onItemChange(key, to)}
                        onDelete={() => this.onItemDelete(key)}
                        extraProps={{...extraProps, editing: editing && !cascaded}}
                    />
                </li>
            )
        }

        if (editing) {
            lis.push(
                <li key="add" className={styles["list-variable-item"]}>
                    <CreateVariableModal
                        selectName={true}
                        variables={variables}
                        onCreate={this.onAdd}
                        renderTrigger={onShow => (
                            <a onClick={onShow}><Icon type="plus" /></a>
                        )}
                    />
                </li>
            )
        }

        return (
            <div className={styles["list-variable"]}>
                <span className={styles["grammar-char"]}>[</span>
                {lis.length > 0 ?
                    (<ul className={styles["list-variable-list"]}>{lis}</ul>) :
                    (<label className={styles["grammar-char"]}>:</label>)
                }
                <span className={styles["grammar-char"]}>]</span>
            </div>
        )
    }
}

function renderVariableField(variable, onChange, extraProps) {
    return (
        <VariableView
            variable={variable.variable}
            onChange={(from, to) => onChange(variable, variable.info.update({variable: to}))}
            extraProps={extraProps}
        />
    )
}

function renderClosureField(variable, onChange, {editing}) {
    return (
        <ClosureView
            closure={variable.closure}
            onChange={closure => onChange(variable, variable.info.update({closure: closure}))}
            readonly={!editing}
        />
    )
}

const VariableViews = {
    unknown: variable => (
        <Fragment>
            <label className={styles["variable-type"]}>{variable.type}</label>
            <span>{variable.value}</span>
        </Fragment>
    ),

    abstracted: () => (
        <label className={styles["variable-type"]}>abstracted</label>
    ),

    appendedList: renderVariableField,

    cached: (variable, onChange, extraProps) => (
        <Fragment>
            <label className={styles["variable-type"]}>cache</label>
            {renderVariableField(variable, onChange, extraProps)}
        </Fragment>
    ),

    cascadeList: (variable, onChange, extraProps) => (
        <ListVariableView variable={variable} onChange={onChange} extraProps={extraProps}/>
    ),

    cascadeMap: (variable, onChange, extraProps) => (
        <MapVariableView variable={variable} onChange={onChange} extraProps={extraProps}/>
    ),

    closure: (variable, onChange, extraProps) => (
        <Fragment>
            <label className={styles["variable-type"]}>closure</label>
            {renderClosureField(variable, onChange, extraProps)}
        </Fragment>
    ),

    encrypted: (variable, onChange, extraProps) => (
        <Fragment>
            <label className={styles["variable-type"]}>decrypt</label>
            {renderVariableField(variable, onChange, extraProps)}
        </Fragment>
    ),

    expandableList: (variable, onChange, extraProps) => (
        <Fragment>
            <label className={styles["variable-type"]}>expand</label>
            {renderVariableField(variable, onChange, extraProps)}
        </Fragment>
    ),

    expandableMap: (variable, onChange, extraProps) => (
        <Fragment>
            <label className={styles["variable-type"]}>expand</label>
            {renderVariableField(variable, onChange, extraProps)}
        </Fragment>
    ),

    filterList: (variable, onChange, extraProps) => (
        <Fragment>
            <label className={styles["variable-type"]}>list</label>
            {renderVariableField(variable, onChange, extraProps)}
            <label className={styles["variable-type"]}>filter by</label>
            {renderClosureField(variable, onChange, extraProps)}
        </Fragment>
    ),

    filterMap: (variable, onChange, extraProps) => (
        <Fragment>
            <label className={styles["variable-type"]}>map</label>
            {renderVariableField(variable, onChange, extraProps)}
            <label className={styles["variable-type"]}>filter by</label>
            {renderClosureField(variable, onChange, extraProps)}
        </Fragment>
    ),

    lazyList: (variable, onChange, extraProps) => (
        <Fragment>
            <label className={styles["variable-type"]}>list</label>
            {renderVariableField(variable, onChange, extraProps)}
        </Fragment>
    ),

    lazyMap: (variable, onChange, extraProps) => (
        <Fragment>
            <label className={styles["variable-type"]}>map</label>
            {renderVariableField(variable, onChange, extraProps)}
        </Fragment>
    ),

    map2list: (variable, onChange, extraProps) => (
        <Fragment>
            <label className={styles["variable-type"]}>values of</label>
            {renderVariableField(variable, onChange, extraProps)}
        </Fragment>
    ),

    simpleList: (variable, onChange, extraProps) => (
        <ListVariableView variable={variable} onChange={onChange} extraProps={extraProps}/>
    ),

    simpleMap: (variable, onChange, extraProps) => (
        <MapVariableView variable={variable} onChange={onChange} extraProps={extraProps}/>
    ),

    simple: (variable, onChange, extraProps) => (
        <SimpleVariableView variable={variable} onChange={onChange} extraProps={extraProps}/>
    ),

    lazy: (variable, onChange, extraProps) => (
        renderClosureField(variable, onChange, extraProps)
    ),

    transformList: (variable, onChange, extraProps) => (
        <Fragment>
            <label className={styles["variable-type"]}>list</label>
            {renderVariableField(variable, onChange, extraProps)}
            <label className={styles["variable-type"]}>convert by</label>
            {renderClosureField(variable, onChange, extraProps)}
        </Fragment>
    ),

    transformMap: (variable, onChange, extraProps) => (
        <Fragment>
            <label className={styles["variable-type"]}>map</label>
            {renderVariableField(variable, onChange, extraProps)}
            <label className={styles["variable-type"]}>convert by</label>
            {renderClosureField(variable, onChange, extraProps)}
        </Fragment>
    ),

    transform: (variable, onChange, extraProps) => (
        <Fragment>
            {renderVariableField(variable, onChange, extraProps)}
            <label className={styles["variable-type"]}>convert by</label>
            {renderClosureField(variable, onChange, extraProps)}
        </Fragment>
    ),

    userParameter: (variable, onChange, extraProps) => (
        <Fragment>
            <label className={styles["variable-type"]}>user parameter</label>
        </Fragment>
    )
};

export class VariableWrapperView extends Component {

    static propTypes = {
        variable: PropTypes.object,
        variables: PropTypes.object,
        readonly: PropTypes.bool,
        onAssignment: PropTypes.func
    };

    state = {
        editing: false,
        draft: null,
        currentActive: null
    };

    changeEditing(editing) {
        this.setState({editing: editing});
    }

    reset() {
        this.setState({
            editing: false,
            draft: null,
            currentActive: null
        });
    }

    onCommit() {
        let {onAssignment} = this.props;
        let {draft} = this.state;
        if (draft) {
            let id = draft.id || VariableInfo.nextID();
            onAssignment(new Assignment({id, variableInfo: draft.info}));
        }
        this.reset();
    }

    onDelete() {
        let {variable, onAssignment} = this.props;
        onAssignment(new Assignment({id: variable.id, variableInfo: variable.info, disabled: true}));
        this.reset()
    }

    onChange(info) {
        this.setState({
            draft: Variable.toVariable(info)
        });
    }

    onCancel() {
        this.reset();
    }

    onFocus(currentActive) {
        this.setState({currentActive});
    }

    render() {
        let {variable, variables, readonly, onAssignment} = this.props;
        let {editing, currentActive, draft} = this.state;

        let operators = [];

        if (!readonly && variables.writable === variable.cradle) {
            if (editing) {
                operators.push(
                    <div onClick={() => this.changeEditing(false)}>
                        <label><Icon type="undo" /> Cancel</label>
                    </div>,
                    <div onClick={() => this.onCommit()}>
                        <label><Icon type="check" /> Commit</label>
                    </div>
                )
            } else {
                if (onAssignment) {
                    if (variable.name && !variable.name.repeatable())
                    operators.push(
                        <div onClick={() => this.changeEditing(true)}>
                            <label><Icon type="edit" /> Edit</label>
                        </div>
                    );
                    if (variable.id) {
                        operators.push(
                            <div onClick={() => this.onDelete()}>
                                <label><Icon type="delete" /> Delete</label>
                            </div>
                        )
                    }
                }
            }
        }

        let finalVariable = editing && draft ? draft : variable;

        let content = (
            <VariableView
                variable={finalVariable}
                onChange={(from, to) => this.onChange(to)}
                extraProps={{
                    editing,
                    currentActive,
                    variables,
                    onFocus: v => this.onFocus(v)
                }}
            />
        );

        if (operators.length > 0) {
            return (
                <Popover placement="leftTop" title="Actions" content={<div>{operators}</div>}>
                    <div>{content}</div>
                </Popover>
            )
        } else {
            return content;
        }
    }
}

export class SimpleVariableDetail extends Component {
    static propTypes = {
        variable: PropTypes.object,
        variables: PropTypes.object
    };

    /**
     * @param {VariableName} name
     */
    static renderChildrenVariableName(name) {
        let ls;
        if (name.repeatable()) {
            ls = name.path.slice(1, name.path.length - 1);
        } else {
            ls = name.path.slice(1);
        }
        return (
            <div className={styles["modifier-title"]}>
                <span
                    className={styles["map-variable-key"]}
                    style={{marginRight: name.repeatable() ? "0.5em" : 0}}>
                    .{ls.join('.')}
                </span>

                {<label className={styles["variable-type"]}>{ name.repeatable() ? "<<" : ":" }</label>}
            </div>
        )
    }

    render() {
        let {variable, variables} = this.props;
        if (variables.contains(variable.name)) {
            return <VariableView variable={variables.get(variable.name)} extraProps={{variables}}/>
        }
        if (variables.containsChildren(variable.name)) {
            let list = Array.from(variables.children(variable.name));
            return (
                <ul className={styles["variable-modifier"]}>
                    {list.map(v => (
                        <li key={v.info.name}>
                            {SimpleVariableDetail.renderChildrenVariableName(v.name)}
                            <VariableView variable={v} extraProps={{variables}}/>
                        </li>
                    ))}
                </ul>
            )
        }
    }
}

export class LayeredVariableDetail extends Component {
    static propTypes = {
        variable: PropTypes.object,
        variables: PropTypes.object
    };

    render() {
        let {variable, variables} = this.props;
        let layers = variables.layers.filter(l => l.contains(variable.name) || l.containsChildren(variable.name));

        return (
            <table className={styles["layered-variable-table"]}>
                {layers.map(layer => (
                    <tr key={layer.source}>
                        <td>{layer.source}</td>
                        <td>
                            { layer instanceof LayeredVariables ?
                                <LayeredVariableDetail variable={variable} variables={layer}/> :
                                <SimpleVariableDetail variable={variable} variables={layer}/>
                            }
                        </td>
                    </tr>
                ))}
            </table>
        );
    }
}

export class VariableValueView extends Component {
    static propTypes = {
        value: PropTypes.object
    };

    render() {
        let {value} = this.props;
        let text;
        if (typeof value === "object") {
            if (value instanceof ContextualVariable) {
                value = value.concrete();
            }
            text = JSON.stringify(value);
        } else {
            text = value;
        }
        return (
            <pre className={styles["variable-value"]}>{text}</pre>
        )
    }
}

export class VariableTable extends Component {

    static propTypes = {
        variables: PropTypes.object,
        selfVariables: PropTypes.object,
        onAssignment: PropTypes.func,
        readOnly: PropTypes.bool
    };

    state = {
        searchKey: "",
        listMode: "all"
    };

    onListModeChange = e => {
        this.setState({listMode: e.target.value});
    };

    onSearch = key => {
        this.setState({searchKey: key});
    };

    onAddVariable = info => {
        let {onAssignment} = this.props;
        onAssignment(Assignment.createAssignment({variableInfo: info}));
    };

    search() {
        let {variables, selfVariables} = this.props;
        let {searchKey, listMode} = this.state;

        let list;
        if (listMode === "all") {
            list = variables.topVariables();
        } else if (listMode === "self") {
            list = selfVariables.topVariables();
        } else if (listMode === "writable") {
            if (selfVariables.writable) {
                list = selfVariables.writable.topVariables();
            } else {
                list = [];
            }
        } else {
            throw "invalid list mode " + listMode;
        }

        if (searchKey) {
            let lowered = searchKey.toLowerCase();
            list = list.filter(v => v.name.first().toLowerCase().includes(lowered));
        }

        return list;
    }

    render() {
        let {variables, onAssignment, readOnly} = this.props;
        let {listMode} = this.state;

        const extraContent = (
            <div>
                {onAssignment && !readOnly && (
                    <CreateVariableModal
                        selectName={true}
                        variables={variables}
                        onCreate={this.onAddVariable}
                        renderTrigger={onShow => (
                            <Button icon="plus-circle" onClick={onShow} style={{marginRight: "1em"}}>
                                Add
                            </Button>
                        )}
                    />
                )}
                <Radio.Group onChange={this.onListModeChange} defaultValue={listMode}>
                    <Radio.Button value="all">All</Radio.Button>
                    <Radio.Button value="self">Self</Radio.Button>
                    <Radio.Button value="writable">Writable</Radio.Button>
                </Radio.Group>
                <Search
                    placeholder="search..."
                    onChange={e => this.onSearch(e.target.value)}
                    onSearch={this.onSearch}
                    style={{width: "200px", marginLeft: "16px"}}
                    defaultValue={this.state.searchKey}
                />
            </div>
        );

        let expandedRowRender;
        if (variables instanceof LayeredVariables) {
            expandedRowRender = variable => (
                <LayeredVariableDetail
                    variable={variable}
                    variables={variables}
                />
            )
        } else {
            expandedRowRender = null;
        }

        let columns = [
            {
                title: 'Name',
                dataIndex: 'info.name',
                key: 'name',
                width: '10em',
                render: (name) => (
                    <a title={name}>{name}</a>
                )
            }, {
                title: 'Type',
                dataIndex: 'type',
                key: 'type',
                width: '5em'
            }, {
                title: 'Value',
                width: '10em',
                render: (value, variable) => (
                    <VariableWrapperView
                        variable={variable}
                        variables={this.props.variables}
                        onAssignment={this.props.onAssignment}
                        readonly={this.props.readOnly}
                    />
                )
            }
        ];

        let table = (
            <Table
                size="middle"
                columns={columns}
                dataSource={this.search()}
                rowKey="info.name"
                pagination={{pageSize: 10, showSizeChanger: true}}
                expandedRowRender={expandedRowRender}
            />
        );

        return (
            <Card extra={extraContent} title={`Variable Table ${variables.source}`}>
                {variables.isEmpty() ? (<span>no vars defined</span>) : table}
            </Card>
        )
    }
}