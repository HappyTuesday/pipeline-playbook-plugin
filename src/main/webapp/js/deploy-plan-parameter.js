/**
 * Manages sharing of deploy-inventory
 *
 * CONCEPT:
 *      snapshot    A snapshot is a json object representing the data of a deploy-inventory
 *
 *      changes     Changes are what we changed against a snapshot to trans it to another snapshot.
 *                  Changes can be gotten by calculate the differences between two snapshots
 *
 *                  Given snapshots S1 and S2, and the differences (changes) C between them, the following holds:
 *
 *                      C = S1 - S2
 *                      S2 = S1 + C
 *
 * Logically we manage three snapshot:
 *
 * base -> outgoing.snapshot -> draft
 *
 * 1. base      The base snapshot is the latest version we fetched from server.
 *
 * 2. outgoing  The outgoing is what sent to server just before.
 *              By using this snapshot, user can continue edit the draft while sending a snapshot to server.
 *              If outgoing is not equal to base, then there is some changes from base snapshot to outgoing snapshot,
 *              but has not yet replied
 *
 * 3. draft     This snapshot represent the current status of what user was seeing and editing by UI.
 *              It is a virtual snapshot.
 *              Every time we using this snapshot, it is calculated from current UI status.
 *
 * And two threads:
 *
 * 1. fetcher   Continuously fetch the latest version of the inventory from server with the specified name at a fixed interval
 * 2. pusher    Continuously push current version of the inventory edited by the local user to server at a fixed interval
 *
 * The algorithm follows.
 *
 * 1.   Download the latest version of the inventory while rendering this page.
 *
 * 2.   Determine if the sharing function is enabled of this inventory by checking
 *      if the sharedBy field of the inventory is set.
 *
 * 3.   If sharing function is enabled, we call 'begin' method to start those two threads (fetcher & pusher).
 *      Otherwise, at a later time the user may enable this function by means of a "Enable Sharing" button on the UI,
 *      this also starts these two threads.
 *
 * 4.   Server will only accepts snapshots with the same version of the specified inventory stored in server,
 *      and then increment this version by one before saving it.
 *
 * 5.   The "fetcher" thread continuously finds new version of the inventory from server. And when a new version is found:
 *
 *      If outgoing is not equal to base. This means a push request was sent to server but has not replied yet.
 *      This can happen in following three cases:
 *
 *      1)  The push request was accepted by server but the reply is on the way back.
 *          As the acceptance logical of server, the new found version must be newer than the "outgoing".
 *          In this case, the changes in outgoing can be safely dropped.
 *      2)  The push request was rejected by server but the reply is on the way back.
 *          So that the new found version does not contain the outgoing changes.
 *          This means what we sent was too old, so the changes from base to outgoing should be merged into "draft" before dropped.
 *      3)  The push request has not reached to server
 *          In this case, the request will be rejected eventually since it does not contain the latest version.
 *          so the outgoing should be treated what we do in case #2.
 *
 *      By attaching a GUID to the snapshot while sending it to server, and assume the server will add this GUID
 *      back to the change list of of the inventory before storing it, we can determine whether our outgoing snapshot was
 *      contained in the new found version.
 *
 *      According to the above three cases and the GUID, we can make following decisions (let the new found version be NEW):
 *
 *      1)  If the outgoing snapshot is included in the new found version:
 *
 *              // do only if the new found version is greater than current version + 1
 *              draft = NEW + (draft - outgoing)
 *
 *      2)  Otherwise the outgoing.snapshot is not included in the new found version:
 *          It will never be included in any new found versions in the future until we send it again.
 *
 *              draft = NEW + (draft - base)
 *
 *      Then reset base & outgoing:
 *
 *          base = NEW
 *          outgoing = NEW
 *
 *      If outgoing is equal to base, calculates described above is harmless.
 *
 *      Since then, we got the final base, draft and outgoing snapshots.
 *
 * 6.   The "pusher" thread continuously sends snapshot to server and save the sent snapshot & changes to outgoing.
 *
 *      The server may accept or reject our snapshot. Usually it will not be very quick to get the reply
 *      after sending the request deal to the variety network properties. After we received the reply, something we
 *      assumed before may have changed, the fetcher may found a new version and alter the outgoing snapshot, for instance.
 *      In that case, what we to do is just nothing. Otherwise, following actions are defined:
 *
 *      a.  Snapshot is rejected:
 *
 *          // just undo outgoing
 *          outgoing = base
 *
 *      b.  Snapshot is accepted:
 *
 *          // now set the outgoing.snapshot as the base snapshot
 *          base = outgoing
 *
 *      Since then, we got the final base, draft and outgoing snapshots.
 *
 * 7.   When we got a new draft, the UI is updated, so user can be noticed the changes made from other users sharing
 *      the same inventory.
 *
 * For convenient, following graphs illustrate all cases we met between fetch & push and base & outgoing & draft.
 * The numbers enclosed in brackets are the exampled versions, * means changed are made to that version, # means local pushed version.
 * At the first time, we have this:
 *
 *      base(1) | outgoing(1) | draft(1)
 *
 * After some time, the user makes an update, so we get this:
 *
 *      base(1) | outgoing(1) | draft(1*)
 *
 * And the pusher & fetcher threads get their works, as following cases (n > 1):
 *
 * 1.   -> push(1*)         -> base(1)  | outgoing(1#) | draft(1#*) // user makes another change based on 1#
 *      -> accept(1*)       => 2 // this means server has accepted our 1* version and define it as 2, but reply is not currently received.
 *      -> pushed(1*)       -> base(1#) | outgoing(1#) | draft(1#*)
 *      -> fetched(n)       -> base(n)  | outgoing(n)  | draft(n + 1#* - 1#)
 *
 * 2.   -> push(1*)         -> base(1)  | outgoing(1#) | draft(1#*)
 *      -> accept(1*)       => 2
 *      -> fetched(n)       -> base(n)  | outgoing(n)  | draft(n + 1#* - 1#)
 *      -> pushed(1*)       // do nothing
 *
 * 3.   -> push(1*)         -> base(1)  | outgoing(1#) | draft(1#*)
 *      -> reject(1*)
 *      -> fetched(n)       -> base(n)  | outgoing(n)  | draft(n + 1#* - 1)
 *      -> push-failed(1*)  // do nothing
 *
 * 4.   -> push(1*)         -> base(1)  | outgoing(1#) | draft(1#*)
 *      -> fetched(n)       -> base(n)  | outgoing(n)  | draft(n + 1#* - 1)
 *      -> reject(1*)
 *      -> push-failed(1*)  // do nothing
 *
 * 5.   -> push(1*)         -> base(1)  | outgoing(1#) | draft(1#*)
 *      -> reject(1*)
 *      -> push-failed(1*)  -> base(1)  | outgoing(1)  | draft(1#*)
 *      -> fetched(n)       -> base(n)  | outgoing(n)  | draft(n + 1#* - 1)
 *
 * 6.   -> fetched(n)       -> base(n)  | outgoing(n)  | draft(n + 1* - 1)
 *      -> push(n*)         -> base(n)  | outgoing(n#) | draft(n#*) // let n* = n + 1* - 1
 *      ...
 */
class SharingManager {

    /**
     * @param inventory {DeployInventory} the deploy inventory object
     * @param base initial base snapshot
     * @param monitor {EntityChangeMonitor} monitor for the changes
     * @param serviceObject {Object} an object used to involve with server
     * @param currentUser {String} the jenkins user by whom this page is requested
     */
    constructor(inventory, base, monitor, serviceObject, currentUser) {
        this.serviceObject = serviceObject;
        this.currentUser = currentUser;
        /**
         * the target deploy inventory object
         * @type {DeployInventory}
         */
        this.inventory = inventory;
        /**
         * thread for fetching latest versions
         * @type {TimerThread}
         */
        this.fetchingThread = new TimerThread(this, this.fetch, this.fetched, 500, 30000);
        /**
         * thread for pushing local snapshots
         * @type {TimerThread}
         */
        this.pushingThread = new TimerThread(this, this.push, this.pushed, 500, 30000);
        /**
         * base snapshot, the latest version fetched from server
         * @type {Object}
         */
        this.base = base;
        /**
         * outgoing snapshot, stores what we just sent to server but no received the reply
         * equal to base means no snapshot are sent after received the reply last time.
         */
        this.outgoing = base;
        /**
         * the id of the changes made on current version of base
         */
        this.changeId = null;
        /**
         * notify the UI whether we are pushing now
         */
        this.pushing = ko.observable(false);
        /**
         * a text describing what we are doing now
         */
        this.lastLog = ko.observable("");

        this.running = ko.observable(false);

        /**
         * represents if there is any changes in the draft after last push
         * @type {boolean}
         */
        this.draftHasChanges = false;
        // monitor the changes in draft
        monitor.listeners.push(() => this.draftHasChanges = true);
    }

    resetBase(base) {
        let running = this.running();
        if (running) this.stop();
        // keep the changes before resetting the outgoing
        this.draftHasChanges |= this.outgoing !== this.base;
        this.base = this.outgoing = base;
        if (running) this.start();
    }

    /**
     * return the draft snapshot
     * @return {Object}
     */
    get draft() {
        return this.inventory.toJson();
    }

    set draft(draft) {
        this.inventory.fromJson(draft);
    }

    /**
     * start the whole sharing process
     */
    start() {
        if (this.running()) {
            return;
        }

        this.log("sharing");
        this.fetchingThread.start();
        this.pushingThread.start();

        this.running(true);
    }

    fetch(callback) {
        this.serviceObject.httpPollDeployInventory(this.inventory.name(), this.base.version + 1, 30000, callback);
    }

    fetched(response) {
        /**
         * @type {{changes: {id: String}[], version: String, sharedBy: String}}
         */
        let latest = response.responseJSON;

        if (!latest) {
            throw "invalid response from server"
        }

        if (latest.version <= this.base.version) {
            // timed out or got an old version, just ignore it
            return;
        }
        /**
         * if the draft has changed after merge:
         * 1.   there are changes before merge
         * 2.   the outgoing is merged into draft, which has changes
         */
        let draftHasChanges = this.draftHasChanges;
        /**
         * The snapshot of the draft.
         * Since all changes are made based on the outgoing and if any changes are made,
         * the draftHashChanges must be true, so we can reuse outgoing if draftHasChanges is false.
         * This can also solve another problem:
         * Since some changes on draft will not change the draftHasChanges, so in this case, after we got a new version
         * the invisible changes will be reset to the latest, to eventually let the draft be in sync.
         */
        let draft = draftHasChanges ? this.draft : this.outgoing;
        let newDraft;
        if (this.outgoing === this.base) { // success case #1, #5, #6
            // We have just successfully pushed a change to server,
            // and the it is the first time after that push,
            // and we got the next version of the local version from server,
            // and our change is included in that version,
            // so it can be proved that this version is just what we have pushed.
            // In this case, ignore it is safe.
            if (latest.version === this.base.version + 1 && this.changeId && this.findChangeById(latest, this.changeId)) {
                newDraft = null; // no merge, no update
            } else {
                newDraft = this.merge(latest, draft, this.base);
                this.log("new changes received");
            }
        } else if (this.findChangeById(latest, this.changeId)) { // success case #2
            // This is the second case where we can skip merge:
            // The latest version is the next version of local version, and it contains the last pushed change.
            if (latest.version === this.outgoing.version + 1) {
                newDraft = null; // no merge, no update
            } else {
                newDraft = this.merge(latest, draft, this.outgoing);
                draftHasChanges = true;
                this.log("new changes merged");
            }
        } else { // rejected case #3, #4
            newDraft = this.merge(latest, draft, this.base);
            draftHasChanges = true;
            this.log("conflict resolved");
        }

        // since the version is changed, so the change id for the previous version is not valid.
        this.changeId = null;
        this.base = this.outgoing = latest;
        // this is the only place to upgrade local version
        this.inventory.version = latest.version;
        if (newDraft != null) {
            this.draft = newDraft;
        }
        this.pushing(false);
        this.draftHasChanges = draftHasChanges;

        if (!latest.sharedBy) {
            this.stop();
        }
    }

    push(callback) {
        if (!this.draftHasChanges && this.outgoing === this.base) return true;

        this.outgoing = this.draft;
        // set to true since we have made a snapshot of the draft
        // this is the only place we clear this mark
        // if some time later, the push request failed, this mark must be set
        this.draftHasChanges = false;
        this.changeId = generateUUID();
        this.pushing(true);
        this.serviceObject.httpSaveDeployInventory(JSON.stringify(this.outgoing), this.changeId, callback);
    }

    pushed(response) {
        if (this.outgoing === this.base) { // case #2, #3, #4
            return; // do nothing
        }
        let result = response.responseJSON;
        if (!result) {
            throw "invalid response from server"
        }
        if (result.status.code === 200) { // case #1, #6. actually case #6 is not concerned at this time
            this.base = this.outgoing;
            this.log("pushed");
            if (result.data) this.inventory.changes(result.data);
            console.info("snapshot pushed. version = " + this.outgoing.version);
        } else { // case #5
            this.outgoing = this.base;
            // what we have tried to push is given up, so this mark is set to enable next retrying
            this.draftHasChanges = true;
            if (result.status.code === 410) {
                this.log("retry pushing deal to conflict");
                console.info("conflict occurred on server while pushing snapshot");
            } else {
                this.log("error occurred while pushing!");
                throw "failed to push snapshot to server: " + result.status.code + " " + result.status.message;
            }
        }
        this.pushing(false);
    }

    stop() {
        if (!this.running()) {
            return;
        }

        this.pushingThread.stop();
        this.fetchingThread.stop();

        if (this.outgoing !== this.base) {
            this.outgoing = this.base;
        }

        this.log("");

        this.running(false);
    }

    findChangeById(snapshot, changeId) {
        for (let i = 0; i < snapshot.changes.length; i++) {
            let change = snapshot.changes[i];
            if (change.id === changeId) return change;
        }
    }

    /**
     * Apply what we changed from origin snapshot to draft snapshot on latest snapshot
     * This is the implementation of the formula described above:
     *
     *      result = latest + (draft - origin)
     *
     * @param latest changes will be applied on latest
     * @param draft draft snapshot
     * @param origin origin snapshot
     * @return {Object}
     */
    merge(latest, draft, origin) {
        // nothing changed
        if (draft === origin) {
            return latest;
        }

        // draft or origin is null
        if (draft === null || draft === undefined) {
            if (origin === null || origin === undefined) {
                return latest;
            } else {
                return draft;
            }
        } else if (origin === null || origin === undefined) {
            return draft;
        } if (latest === null || latest === undefined) {
            return latest;
        }

        // type unmatched
        if (typeof draft !== typeof origin || typeof draft !== typeof latest) {
            return draft;
        }

        if (typeof draft !== "object") {
            return draft;
        }

        // one is array but another is not
        if (Array.isArray(draft) !== Array.isArray(origin) || Array.isArray(draft) !== Array.isArray(latest)) {
            return draft;
        }

        let snapshot, p;

        // both are not array
        if (!Array.isArray(draft)) {
            snapshot = {};
            for (p in draft) {
                if (draft.hasOwnProperty(p)) {
                    snapshot[p] = this.merge(latest[p], draft[p], origin[p]);
                }
            }
            for (p in latest) {
                if (latest.hasOwnProperty(p) && !draft.hasOwnProperty(p)) {
                    snapshot[p] = this.merge(latest[p], undefined, origin[p]);
                }
            }
            return snapshot;
        }

        // the last case, both are arrays
        let i, s;
        let originJoin = draft.arrayInnerJoin(origin);
        let latestJoin = draft.arrayInnerJoin(latest);
        let originMatch = originJoin.left, latestMatch = latestJoin.left, matchLatest = latestJoin.right, pairs = [];
        for (i = 0; i < draft.length; i++) {
            if (latestMatch[i] === undefined) {
                if (originMatch[i] === undefined) { // created by local
                    s = draft[i];
                } else { // dropped by server
                    s = undefined;
                }
            } else {
                if (originMatch[i] === undefined) { // created both by local and server
                    s = this.merge(latest[latestMatch[i]], draft[i], undefined);
                } else { // normal case
                    s = this.merge(latest[latestMatch[i]], draft[i], origin[originMatch[i]]);
                }
            }

            if (s !== undefined && s !== null) {
                pairs.push({i: i, s: s});
            }
        }
        for (i = 0; i < latest.length; i++) {
            if (matchLatest[i] === undefined) { // created by server
                pairs.push({j: i, s: latest[i]});
            }
        }

        // do our best to keep the order of array made by remote server as well as local's
        pairs.sort(function (a, b) {
            if (a.i !== undefined && b.i !== undefined) {
                if (originMatch[a.i] !== undefined && originMatch[b.i] !== undefined) {
                    if (latestMatch[a.i] !== undefined && latestMatch[b.i] !== undefined) { // both exists
                        // if we do not change the order, use the order of made by server
                        if (a.i < b.i === originMatch[a.i] < originMatch[b.i]) {
                            return latestMatch[a.i] < latestMatch[b.i] ? -1 : 1;
                        }
                    }
                }
                return a.i < b.i ? -1 : 1;
            } else if (a.j !== undefined && b.j !== undefined) {
                // both created by server
                return a.j < b.j ? -1 : 1;
            } else if (a.i !== undefined && b.j !== undefined && latestMatch[a.i] !== undefined) {
                // one in latest with one crated by server
                return latestMatch[a.i] < b.j ? -1 : 1;
            } else if (a.j !== undefined && b.i !== undefined && latestMatch[b.i] !== undefined) {
                // one crated by server with one in latest
                return a.j < latestMatch[b.i] ? -1 : 1;
            } else {
                // one created by local with one created by server
                return 0;
            }
        });

        snapshot = [];
        for (i = 0; i < pairs.length; i++) {
            snapshot.push(pairs[i].s);
        }

        return snapshot;
    }

    log(s) {
        this.lastLog(s);
    }
}

/**
 * Let this be similar with b, in order and length and content
 * @param {Object} operator
 * @param {Array} b
 * @param {Function} [creator]
 * @param {Function} [updater]
 */
Array.prototype.conciliate = function (operator, b, creator, updater) {
    let a = this;
    let join = this.arrayInnerJoin(b), i, j, deleted = 0, order = [], t;
    for (i = 0; i < a.length; i++) {
        j = join.left[i + deleted];
        if (j === undefined) {
            operator.splice(i--, 1); // element in this should be removed by the operator
            deleted++;
        } else {
            if (updater) updater(a[i], b[j]);
            order.push(j);
        }
    }
    for (j = 0; j < b.length; j++) {
        if (join.right[j] === undefined) {
            operator.push(creator ? creator(b[j]) : b[j]); // element should be pushed into this by the operator
            order.push(j);
        }
    }
    for (i = 0; i < a.length - 1; i++) {
        for (j = i + 1; j < a.length; j++) {
            if (order[i] > order[j]) {
                t = order[i];
                order[i] = order[j];
                order[j] = t;
                t = a[i];
                operator.splice(i, 1, a[j]); // elements in this should be swapped by the operator
                operator.splice(j, 1, t);
            }
        }
    }
};

/**
 * Inner join two arrays, with id of each element in one array equals another id belongs to another array
 * @param {Array} b
 * @return {{left: {}, right: {}}} mapping of a.index -> b.index and b.index -> a.index
 */
Array.prototype.arrayInnerJoin = function (b) {
    let a = this;
    let left = {}, right = {}, map = {}, id, indices, i, j;
    for (i = 0; i < a.length; i++) {
        id = typeof a[i] === "object" ? a[i].id : a[i];
        indices = map[id];
        if (indices === undefined) {
            map[id] = [i];
        } else {
            indices.push(i);
        }
    }
    for (j = 0; j < b.length; j++) {
        id = typeof b[j] === "object" ? b[j].id : b[j];
        indices = map[id];
        if (indices !== undefined && indices.length > 0) {
            i = indices.shift();
            left[i] = j;
            right[j] = i;
        }
    }
    return {left: left, right: right};
};

/**
 * An implementation for thread based on js timer.
 */
class TimerThread {
    /**
     * @param instance {Object} the instance of this while calling runnable and callback
     * @param runnable {Function} the function to run in the thread, the sole argument of this function
     *                            is a callback used in timer thread and should be passed as the callback of your real function.
     *                            returning true means you want to use sync mode, the callback will not be called in this case.
     * @param callback {Function} callback called after the runnable's callback is called
     * @param interval {Number} interval of the time after a callback is called before another runnable is launched.
     * @param timeout {Number} how long before a call is treated as timeout
     */
    constructor(instance, runnable, callback, interval, timeout) {
        this.instance = instance;
        this.runnable = runnable;
        this.callback = callback;
        this.interval = interval === undefined || interval < 0 ? 0 : interval;
        this.tickInverval = 100;
        this.timeoutInterval = timeout === undefined ? -1 : timeout;
        this.timer = null;
        this.processing = false;
        let now = new Date().getTime();
        this.processBeginTime = now;
        this.idleBeginTime = now;
        this.loops = 0;
    }

    start() {
        if (this.timer) {
            this.stop();
        }
        this.idleBeginTime = new Date().getTime() - this.interval; // avoid first wait
        this.timer = setInterval(this.tick.bind(this), this.tickInverval);
    }

    stop() {
        if (!this.timer) return;
        clearInterval(this.timer);
        this.processing = false;
        this.loops++; // avoid future callbacks
    }

    tick() {
        this.loop();
    }

    loop() {
        const now = new Date().getTime();
        if (this.processing) { // runnable is already started
            if (this.timeoutInterval < 0 || now - this.processBeginTime < this.timeoutInterval) {
                return; // do not timeout, continue waiting
            }
            this.processing = false; // timeout
        }

        if (now - this.idleBeginTime < this.interval) {
            return; // wait the entire interval
        }

        let loops = ++this.loops;
        this.processBeginTime = new Date().getTime();
        let sync = false;
        try {
            sync = this.runnable.call(this.instance, (... args) => {
                if (this.loops !== loops) return; // avoid to call older callbacks

                try {
                    this.callback.apply(this.instance, args);

                    this.processing = false;
                    this.idleBeginTime = new Date().getTime();
                    this.loop();
                } catch (e) {
                    console.error(e);
                }
            });

            if (sync) {
                this.processing = false;
                this.idleBeginTime = new Date().getTime();
            } else {
                this.processing = true;
            }
        } catch (e) {
            console.error(e);
            // exception is treated as async
            // so next retry will come after timeout
        }
    }
}

/**
 * Represents a view model
 */
class ViewModel {
    /**
     * @param {EntityChangeMonitor} monitor
     */
    constructor(monitor) {
        this.monitor = monitor;
    }

    /**
     * add extenders to 
     * @param observable
     * @return {Function}
     */
    withMonitor(observable) {
        if (this.monitor) {
            observable = observable.extend({audit: value => this.monitor.onchange(this, name, value)});
        }
        return observable;
    }

    showElement(e) {
        jQuery(e).hide().fadeIn();
    }

    hideElement(e) {
        jQuery(e).fadeOut(() => jQuery(e).remove());
    }
}

class DeployPlanViewModel extends ViewModel {
    /**
     * @param {EntityChangeMonitor} monitor
     * @param serviceObject
     * @param currentUser
     * @param environmentJson
     * @param deployInventoryJson
     * @param predefinedInventoryListJson
     */
    constructor (monitor, serviceObject, currentUser, environmentJson, deployInventoryJson, predefinedInventoryListJson) {
        super(monitor);

        this.serviceObject = serviceObject;
        this.currentUser = currentUser;
        this.environment = environmentJson;
        this.savedInventoryNames = ko.observableArray([]);
        this.deployInventory = new DeployInventory(this, deployInventoryJson);
        this.predefinedInventoryList = predefinedInventoryListJson;
        this.originDeployInventoryJson = this.deployInventory.toJson();
        this.enableConfirmBeforeLeaving = true;
        this.hasChanges = false;
        monitor.listeners.push(() => this.hasChanges = true);

        this.listSavedInventoryNames();
        window.onbeforeunload = () => {
            if (this.enableConfirmBeforeLeaving && this.hasChanges) {
                return "Are you sure to leave this page?"
            }
        };
        this.registerEventHandlers();
    }
    
    registerEventHandlers() {
        this.onLoadSavedInventory = (inventoryName) => {
            this.loadSavedInventory(inventoryName);
        };

        this.onSearchSavedInventories = (inventoryName) => {
            this.loadSavedInventory(inventoryName);
            return "";
        };

        this.onLoadLastInventory = () => {
            this.loadLastInventory();
        };

        this.onSaveInventory = () => {
            this.saveInventory(this.deployInventory);
        };

        this.onRemoveInventory = (inventoryName) => {
            if (confirm("are you sure to remove inventory " + inventoryName)) {
                this.removeInventory(inventoryName);
            }
        };

        this.onAppendPredefinedPlansToCurrentInventory = (inventoryJson) => {
            this.deployInventory.createPlans(inventoryJson.plans);
        };

        this.onAppendSavedPlansToCurrentInventory = (inventoryName) => {
            this.serviceObject.httpGetDeployInventory(inventoryName, res => {
                this.deployInventory.createPlans(res.responseJSON.plans);
            });
        };

        this.onLoadPredefinedInventory = (inventoryJson) => {
            this.deployInventory.fromJson(inventoryJson);
        };

        this.onExecuteBuild = () => {
            this.enableConfirmBeforeLeaving = false;
            jQuery('.submit-button[name=Submit] button').click();
        };
    }

    listSavedInventoryNames() {
        this.serviceObject.getSavedInventoryNames(res => {
            this.savedInventoryNames(res.responseJSON);
        });
    }

    loadLastInventory() {
        this.serviceObject.getLastInventory(res => {
            this.updateInventory(res.responseJSON);
        });
    }

    loadSavedInventory(inventoryName) {
        this.serviceObject.httpGetDeployInventory(inventoryName, res => {
            this.updateInventory(res.responseJSON);
        });
    }

    updateInventory(inventoryJson) {
        this.deployInventory.fromJson(inventoryJson, true);
        this.hasChanges = false;
    }

    saveInventory(inventory) {
        let inventoryJson = inventory.toJson();
        this.serviceObject.httpSaveDeployInventory(JSON.stringify(inventoryJson), generateUUID(), res => {
            let result = res.responseJSON;
            if (result.status.code === 200 || result.status.code === 201) {
                inventory.updateDate(formatDate(new Date()));
                if (result.changes) inventory.changes(result.changes);
                if (this.savedInventoryNames().indexOf(inventoryJson.name) < 0) {
                    this.savedInventoryNames.splice(0, 0, inventoryJson.name);
                }
                this.hasChanges = false;
            } else {
                alert("failed to save inventory " + inventory.name() + ": " + result.status.code + " " + result.status.message);
            }
        });
    }

    removeInventory(inventoryName) {
        this.serviceObject.removeInventory(inventoryName, () => {
            let index = this.savedInventoryNames().indexOf(inventoryName);
            if (index >= 0) {
                this.savedInventoryNames.splice(index, 1);
                if (this.deployInventory.name() === inventoryName) {
                    this.deployInventory.updateDate("");
                }
            }
        });
    }
}

class DeployInventory extends ViewModel {
    /**
     * @param {DeployPlanViewModel} viewModel
     * @param json
     */
    constructor(viewModel, json) {
        super(viewModel.monitor);
        this.viewModel = viewModel;
        this.environment = viewModel.environment;
        this.envName = this.environment.name;

        this.editingName = ko.observable(false);
        this.name = this.withMonitor(ko.observable());
        this.ignoreFailure = this.withMonitor(ko.observable());
        this.autoAdjustOrder = this.withMonitor(ko.observable());
        this.confirmBeforeExecute = this.withMonitor(ko.observable());
        this.retries = this.withMonitor(ko.observable());
        this.confirmBeforeRetry = this.withMonitor(ko.observable());
        this.updateDate = ko.observable();
        this.noInterrupt = this.withMonitor(ko.observable());
        this.showUsageDescription = ko.observable();
        this.autoAdjustBranch = this.withMonitor(ko.observable());
        this.owner = this.withMonitor(ko.observable());
        this.usageDescription = this.withMonitor(ko.observable());
        this.notificationMails = this.withMonitor(ko.observable());
        this.changes = ko.observable();
        this.sharedBy = this.withMonitor(ko.observable());
        this.version = "";
        this.plans = this.withMonitor(ko.observableArray());

        this.shared = ko.pureComputed(() => !!this.sharedBy());
        this.sharedByMe = ko.pureComputed(() => this.sharedBy() === this.viewModel.currentUser);

        this.sharingManager = new SharingManager(this, json, viewModel.monitor, viewModel.serviceObject, viewModel.currentUser);
        this.registerEventHandlers();
        this.fromJson(json);
    }

    /**
     * update fields from json
     * @param json
     * @param reset set to true if you want to restart sharing if enabled
     */
    fromJson(json, reset = false) {
        this.name(json.name);
        this.ignoreFailure(json.ignoreFailure);
        this.autoAdjustOrder(json.autoAdjustOrder);
        this.confirmBeforeExecute(json.confirmBeforeExecute);
        this.retries(json.retries || 3);
        this.confirmBeforeRetry(json.confirmBeforeRetry);
        this.updateDate(json.updateDate);
        this.noInterrupt(json.noInterrupt);
        this.showUsageDescription(json.showUsageDescription);
        this.autoAdjustBranch(json.autoAdjustBranch);
        this.owner(json.owner);
        this.usageDescription(json.usageDescription);
        this.notificationMails(json.notificationMails);
        this.changes(json.changes);
        this.sharedBy(json.sharedBy);
        this.version = json.version;
        
        let plans = json.plans && json.plans.length > 0 ? json.plans : [{id: generateUUID()}];
        this.plans().conciliate(this.plans, plans,
                planJson =>  new DeployPlan(this, planJson),
                (plan, planJson) => plan.fromJson(planJson));

        if (reset) {
            this.sharingManager.resetBase(json);
        }

        if (this.sharedBy()) {
            this.sharingManager.start();
        } else {
            this.sharingManager.stop();
        }
    }

    toJson() {
        return {
            envName: this.envName,
            name: this.name(),
            ignoreFailure: this.ignoreFailure(),
            autoAdjustOrder: this.autoAdjustOrder(),
            confirmBeforeExecute: this.confirmBeforeExecute(),
            retries: this.retries(),
            confirmBeforeRetry: this.confirmBeforeRetry(),
            noInterrupt: this.noInterrupt(),
            showUsageDescription: this.showUsageDescription(),
            autoAdjustBranch: this.autoAdjustBranch(),
            owner: this.owner(),
            usageDescription: this.usageDescription(),
            notificationMails: this.notificationMails(),
            sharedBy: this.sharedBy(),
            version: this.version,
            plans: this.plans().map(p => p.toJson())
        };
    }

    registerEventHandlers() {
        this.onAddPlan = () => {
            this.createPlan({id: generateUUID()});
        };

        this.onEditName = () => {
            this.editingName(true);
        };

        this.onTakeoverSharing = () => {
            let shared = !!this.sharedBy();
            this.sharedBy(this.viewModel.currentUser);
            if (!this && this.sharedBy()) {
                this.start();
            }
        };

        this.onEnableSharing = () => {
            this.sharedBy(this.viewModel.currentUser);
            if (this.sharedBy()) {
                this.sharingManager.start();
            }
        };
        
        this.onDisableSharing = () => {
            this.sharingManager.stop();
            this.sharedBy("");
        };
    }

    createPlans(plans) {
        for (let i = 0; i < plans.length; i++) {
            this.createPlan(plans[i])
        }
    }

    createPlan(planJson, index = -1) {
        if (index < 0) index = this.plans().length;
        this.plans.splice(index, 0, new DeployPlan(this, planJson));
    }

    removePlan(plan) {
        this.plans.splice(this.plans().indexOf(plan), 1);
    }

    swapTwoPlans(plan1, plan2) {
        let plan2Index = this.plans().indexOf(plan2);
        this.plans.splice(this.plans().indexOf(plan1), 1, plan2);
        this.plans.splice(plan2Index, 1, plan1);
    }

    swapWithPreviousPlan(plan) {
        let index = this.plans().indexOf(plan);
        if (index > 0) {
            this.swapTwoPlans(this.plans()[index-1], plan);
        }
    }

    swapWithNextPlan(plan) {
        let index = this.plans().indexOf(plan);
        if (index < this.plans().length - 1) {
            this.swapTwoPlans(plan, this.plans()[index+1]);
        }
    }

    findSingleProjectInEnvironment(key) {
        let ps = this.environment.projects, res = [];
        for (let i = 0; i < ps.length; i++) {
            if (ps[i].projectName === key) {
                return ps[i];
            } else if (ps[i].projectName.indexOf(key) >= 0) {
                res.push(ps[i]);
            }
        }
        if (res.length === 1) return res[0];
    }
}

class DeployPlan extends ViewModel {
    /**
     * @param {DeployInventory} inventory
     * @param json
     */
    constructor(inventory, json) {
        super(inventory.monitor);
        this.inventory = inventory;

        this.registerGlobalParameter('buildVersion', 'build_version');

        this.id = json.id || generateUUID();
        this.editDescription = ko.observable(false);
        this.showAdvancedOptions = ko.observable(false);
        this.deploySummaryHasFocus = ko.observable(false);
        this.deploySummaryLines = null;
        this.confirmBeforeFinish = this.withMonitor(ko.observable());
        this.reverseOrder = this.withMonitor(ko.observable());
        this.description = this.withMonitor(ko.observable());
        this.parallel = this.withMonitor(ko.observable());
        this.verifyMessage = ko.observable();
        this.requestRefresh = this.withMonitor(ko.observable());
        this.items = this.withMonitor(ko.observableArray());
        this.syncMessage = ko.observable();
        this.extraTasksToSkip = this.withMonitor(ko.observableArray());
        
        this.addComputedProperties();
        this.registerEventHandlers();
        this.fromJson(json);
        this.sortItems();
    }

    fromJson(json) {
        this.confirmBeforeFinish(json.confirmBeforeFinish);
        this.reverseOrder(json.reverseOrder);
        this.description(json.description || "plan");
        this.parallel(json.parallel <= 0 ? 8 : json.parallel);
        this.verifyMessage(json.verifyMessage);
        this.requestRefresh(json.requestRefresh);
        this.syncMessage(json.syncMessage);
        this.extraTasksToSkip(json.extraTasksToSkip || []);

        this.items().conciliate(this.items, json.items || [],
                itemJson => new DeployItem(this, itemJson),
                (item, itemJson) => item.fromJson(itemJson));
    }

    toJson() {
        return {
            id: this.id,
            confirmBeforeFinish: this.confirmBeforeFinish(),
            reverseOrder: this.reverseOrder(),
            description: this.description(),
            parallel: this.parallel(),
            verifyMessage: this.verifyMessage(),
            syncMessage: this.syncMessage(),
            requestRefresh: this.requestRefresh(),
            extraTasksToSkip: this.extraTasksToSkip(),
            items: this.items().map(item => item.toJson())
        };
    }

    addComputedProperties() {
        this.deploySummary = ko.pureComputed({
            read: this.getDeploySummary,
            write: this.setDeploySummary,
            owner: this
        });

        this.leftItemsJson = ko.pureComputed(() => {
            let items = this.items();
            return this.inventory.environment.projects.filter((p) => {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].projectName() === p.projectName) {
                        return false;
                    }
                }
                return true;
            });
        });

        this.expandAllItems = ko.pureComputed({
            read: () => {
                let items =  this.items();
                for (let i = 0; i < items.length; i++) {
                    if (!items[i].expanded()) return false;
                }
                return items.length !== 0;
            },
            write: value => {
                let items =  this.items();
                for (let i = 0; i < items.length; i++) {
                    items[i].expanded(value);
                }
            },
            owner: this
        });

        this.servers = ko.pureComputed(() => {
            let servers = [], items = this.items();
            for (let i = 0; i < items.length; i++) {
                let ss = items[i].project().servers;
                for (let j = 0; j < ss.length; j++) {
                    if (servers.indexOf(ss[j]) < 0) servers.push(ss[j]);
                }
            }
            return servers;
        });

        this.serversChosen = ko.pureComputed({
            read: this.getServersChosen,
            write: this.setServersChosen,
            owner: this
        });

        this.chosenAllServers = ko.pureComputed({
            read: this.getChosenAllServers,
            write: this.setChosenAllServers,
            owner: this
        });

        this.reverseOrderUI = ko.pureComputed({
            read: this.reverseOrder,
            write: (value) => {
                if (value !== this.reverseOrder()) {
                    this.reverseOrder(value);
                    this.reverseItems();
                }
            },
            owner: this
        });

        this.sections = ko.pureComputed(() => this.getSections());
        this.sectionsChosen = ko.pureComputed({
            read: this.getSectionsChosen,
            write: this.setSectionsChosen,
            owner: this
        });

        this.projectCount = ko.pureComputed(() => this.items().reduce((count, item) => count + item.projectCount(), 0));

        this.dependencyGraphData = ko.pureComputed(() => this.getDependencyGraphData()).extend({ rateLimit: 500 });

        this.projectAutoCompleteFormat = (projectJson) => projectJson.projectName || "";
        this.projectAutoCompleteOnSelect = (projectJson) => {
            this.insertItem(this.createEmptyItemJson(projectJson));
            return "";
        };

        this.allTasks = ko.pureComputed(() => {
            let items = this.items();
            let ls = [];
            for (let item of items) {
                ls.push(...item.project().skipTags);
            }
            return ls.uniq()
        });
    }

    getDependencyGraphData() {
        let groups = {}, groupKeys = [], allItems = this.items(), i, j, items, item, group, data = [];
        for (i = 0; i < allItems.length; i++) {
            item = allItems[i];
            let key = item.project().jobOrder;
            if (key in groups) {
                groups[key].items.push(item);
            } else {
                groupKeys.push(key);
                groups[key] = {
                    items: [item],
                    id: 'group' + key,
                    title: 'group ' + key,
                    order: item.project().jobOrder
                }
            }
        }
        groupKeys.sort();

        for (i = 0; i < groupKeys.length; i++) {
            group = groups[groupKeys[i]];
            group.graph = this.getItemsDependencyGraph(group.items);
            let topologyResult = group.graph.topology();
            group.topology = topologyResult.path;
            group.loop = topologyResult.loop;
        }

        for (i = 0; i < groupKeys.length; i++) {
            group = groups[groupKeys[i]];

            data.push({
                data: {
                    id: group.id,
                    title: group.title,
                    order: group.order
                },
                grabbable: false
            });

            items = group.graph.nodes();
            for (j = 0; j < items.length; j++) {
                item = items[j];
                data.push({
                    data: {
                        id: item.id,
                        title: item.itemTitle(),
                        parent: group.id
                    },
                    classes: group.loop.indexOf(item) >= 0 ? 'in-loop' : ''
                });
            }

            for (j = 0; j < items.length; j++) {
                item = items[j];
                let next = group.graph.next(item.id);
                for (let k = 0; k < next.length; k++) {
                    let item2 = next[k];
                    data.push({
                        data: {
                            id: item.id + "-" + item2.id,
                            source: item.id,
                            target: item2.id
                        },
                        classes: group.loop.indexOf(item) >= 0 && group.loop.indexOf(item2) >= 0 ? 'in-loop' : ''
                    });
                }
            }
        }

        for (i = 1; i < groupKeys.length; i++) {
            let source = groups[groupKeys[i-1]].id, target = groups[groupKeys[i]].id;
            data.push({
                data: {
                    id: source + '-' + target,
                    source: source,
                    target: target
                }
            });
        }

        return data;
    }

    getSections() {
        let sections = [], ps = this.inventory.environment.projects;
        for (let i = 0; i < ps.length; i++) {
            let s = ps[i].sectionName;
            if (sections.indexOf(s) < 0) sections.push(s);
        }
        return sections;
    }

    getSectionsChosen() {
        let sections = [], items = this.items();
        for (let i = 0; i < items.length; i++) {
            let s = items[i].project().sectionName;
            if (sections.indexOf(s) < 0) sections.push(s);
        }
        return sections;
    }

    setSectionsChosen(sections) {
        let i, chosen = [], s, item, removingItems = [];
        for (i = 0; i < this.items().length; i++) {
            item = this.items()[i];
            s = item.project().sectionName;
            if (sections.indexOf(s) < 0) {
                removingItems.push(item.projectName());
            } else if (chosen.indexOf(s) < 0) {
                chosen.push(s);
            }
        }
        for (i = 0; i < removingItems.length; i++) {
            this.removeItem(removingItems[i]);
        }
        let psJson = this.inventory.environment.projects;
        for (i = 0; i < sections.length; i++) {
            s = sections[i];
            if (chosen.indexOf(s) < 0) {
                for (let j = 0; j < psJson.length; j++) {
                    if (psJson[j].sectionName === s) {
                        this.insertItem(this.createEmptyItemJson(psJson[j]));
                    }
                }
            }
        }
    }

    getChosenAllServers() {
        return this.servers().length === this.serversChosen().length;
    }

    setChosenAllServers(value) {
        if (value) {
            this.serversChosen(this.servers().slice(0));
        } else {
            this.serversChosen([]);
        }
    }

    getServersChosen() {
        let servers = [], items = this.items();
        for (let i = 0; i < items.length; i++) {
            let ss = items[i].servers();
            for (let j = 0; j < ss.length; j++) {
                if (servers.indexOf(ss[j]) < 0) servers.push(ss[j]);
            }
        }
        return servers;
    }

    setServersChosen(servers) {
        let items = this.items(), s, j;
        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            for (j = 0; j < servers.length; j++) {
                s = servers[j];
                if (item.project().servers.indexOf(s) >= 0 && item.servers().indexOf(s) < 0) {
                    item.servers.push(s);
                }
            }
            for (j = 0; j < item.servers().length; j++) {
                s = item.servers()[j];
                if (servers.indexOf(s) < 0) {
                    item.servers.splice(j, 1);
                    j--;
                }
            }
        }
    }

    getDeploySummary() {
        if (this.deploySummaryLines == null || !this.deploySummaryHasFocus()) {
            let lines = [];
            for (let i = 0; i < this.items().length; i++) {
                if (this.items()[i].projectName()) {
                    lines.push(this.items()[i].toSummaryString());
                }
            }
            this.deploySummaryLines = lines;
        }

        return this.deploySummaryLines.join('\n');
    }

    setDeploySummary(value) {
        let lines = (value || "").split('\n');
        this.deploySummaryLines = lines;
        let items = [], i, item;
        for (i = 0; i < lines.length; i++) {
            let line = lines[i];
            line = this.transformDeployLine(line);
            let spans = line.split(/[ :\t\[\]\(\)]+/);
            if (spans.length === 0) continue;
            let name = spans.shift();
            item = this.findSingleItem(name);
            if (item) {
                item.fromSummaryString(spans);
                items.push(item);
            } else {
                let projectJson = this.inventory.findSingleProjectInEnvironment(name);
                if (projectJson) {
                    item = new DeployItem(this, this.createEmptyItemJson(projectJson));
                    item.fromSummaryString(spans);
                    this.insertItem(item.toJson());
                    item = this.findItem(projectJson.projectName);
                    if (item) {
                        items.push(item);
                    }
                }
            }
        }
        for (i = 0; i < this.items().length; i++) {
            item = this.items()[i];
            if (items.indexOf(item) < 0 && item.projectName()) {
                this.removeItem(item.projectName());
            }
        }

        this.sortItems()
    }

    transformDeployLine(line) {
        if ((line.indexOf('api') >= 0 || line.indexOf('gateway') >= 0) && (line.indexOf('reload') >= 0 || line.indexOf('加载') >= 0))
            return "api-gateway-reload-api";

        if (line.indexOf('apigateway') >= 0 || line.indexOf('gateway') >= 0)
            line = line.replace(/(?:apigateway)|(?:.* gateway)|(?:^gateway)/, 'api-gateway');
        if (line.indexOf('service') >= 0)
            line = line.replace(/(\w+) +service/, '$1-service');
        if (line.indexOf('tag'))
            line = line.replace(/[ \-:]+tag/, '');
        return line;
    }

    insertItem(itemJson) {
        let item = this.findItem(itemJson.projectName);
        if (item) return item;

        item = new DeployItem(this, itemJson);
        let insertPoint = this.getItemInsertPoint(item.project().jobOrder);
        this.items.splice(insertPoint, 0, item);
        this.sortItemsInGroup(insertPoint);

        return item;
    }

    removeItem(projectName) {
        let index = this.findItemIndex(projectName);
        if (index < 0) return;

        let items = this.items(),
            item = items[index],
            order = item.project().jobOrder;

        for (let i = 0; i < items.length; i++) {
            if (i !== index) {
                items[i].beforePlanRemoveItem(item);
            }
        }

        this.items.splice(index, 1);

        if (index - 1 >= 0 && items[index-1].project().jobOrder === order) {
            this.sortItemsInGroup(index-1);
        } else if (index < items.length && items[index].project().jobOrder === order) {
            this.sortItemsInGroup(index);
        }
    }

    sortItems() {
        let i, j, items = this.items(), reverseOrder = this.reverseOrder();
        for (i = 0; i < items.length - 1; i++) {
            for (j = i + 1; j < items.length; j++) {
                let x = items[i], y = items[j];
                if (reverseOrder ^ x.project().jobOrder > y.project().jobOrder) {
                    let temp = items[i];
                    items[i] = items[j];
                    items[j] = temp;
                }
            }
        }
        for (i = 0; i < items.length;) {
            let group = this.getItemsInGroup(i).items;
            group = group.length === 1 ? group : this.topologySort(group);
            for (j = 0; j < group.length; i++, j++) {
                items[i] = group[j];
            }
        }
        this.items(items);
    }

    sortItemsInGroup(index) {
        let itemsInGroup = this.getItemsInGroup(index),
            group = itemsInGroup.items;

        if (group.length > 1) {
            let args = [itemsInGroup.startIndex, group.length].concat(this.topologySort(group));
            this.items.splice.apply(this.items, args);
        }
    }

    getItemsInGroup(index) {
        let items = this.items(), group = [items[index]], order = items[index].project().jobOrder, i;
        for (i = index - 1; i >= 0 && items[i].project().jobOrder === order; i--) {
            group.unshift(items[i]);
        }
        let startIndex = index - group.length + 1;
        for (i = index + 1; i < items.length && items[i].project().jobOrder === order; i++) {
            group.push(items[i]);
        }
        return {
            items: group,
            startIndex: startIndex
        };
    }

    topologySort(items) {
        return this.getItemsTopology(items).path;
    }

    getItemsTopology(items) {
        return this.getItemsDependencyGraph(items).topology();
    }

    getItemsDependencyGraph(items) {
        let g = new Graph(), i;
        for (i = 0; i < items.length; i++) {
            g.node(items[i].id, items[i]);
        }
        for (i = 0; i < items.length; i++) {
            let item = items[i];
            let deps = item.project().dependencies.concat(item.dependencies());
            for (let j = 0; j < deps.length; j++) {
                let item2 = this.findItem(deps[j]);
                if (item2) {
                    if (this.reverseOrder()) {
                        g.arc(item.id, item2.id);
                    } else {
                        g.arc(item2.id, item.id);
                    }
                }
            }
        }
        return g;
    }

    findItemById(itemId) {
        let items = this.items();
        for (let i = 0; i < items.length; i++) {
            if (items[i].id === itemId) {
                return items[i];
            }
        }
    }

    findItem(projectName) {
        let index = this.findItemIndex(projectName);
        if (index >= 0) {
            return this.items()[index];
        }
    }

    findItemIndex(projectName) {
        let items = this.items();
        for (let i = 0; i < items.length; i++) {
            if (items[i].projectName() === projectName && projectName) return i;
        }
        return -1;
    }

    findSingleItem(key) {
        for (let i = 0; i < this.items().length; i++) {
            let item = this.items()[i];
            if (item.projectName() === key) {
                return item;
            }
        }
    }

    getItemInsertPoint(jobOrder) {
        let items = this.items();
        for (let i = 0; i < items.length; i++) {
            if (this.reverseOrder() ^ jobOrder < items[i].project().jobOrder) {
                return i;
            }
        }
        return items.length;
    }

    reverseItems() {
        let len = this.items().length;
        for (let i = 0; i < Math.floor(len / 2); i++) {
            let item = this.items()[i];
            this.items.splice(i, 1, this.items()[len - 1 - i]);
            this.items.splice(len - 1 - i, 1, item);
        }
    }

    registerEventHandlers() {
        this.onCopy = () => {
            this.inventory.createPlan(this.toJson(), this.inventory.plans().indexOf(this));
        };

        this.onRemove = () => {
            this.inventory.removePlan(this);
        };

        this.onSwapWithPrevious = () => {
            this.inventory.swapWithPreviousPlan(this);
        };

        this.onSwapWithNext = () => {
            this.inventory.swapWithNextPlan(this);
        };

        this.onDescriptionClick = () => {
            this.editDescription(true);
        };

        this.onDescriptionEditorBlur = () => {
            this.editDescription(false);
        };

        this.onToggleAdvancedOptions = () => {
            this.showAdvancedOptions(!this.showAdvancedOptions());
        };

        this.onGraphRemoveNode = (itemId) => {
            let item = this.findItemById(itemId);
            if (item) {
                item.onRemove();
            }
        };

        this.onGraphAddDependency = (fromItemId, toItemId) => {
            let from = this.findItemById(fromItemId), to = this.findItemById(toItemId);
            if (from && to && from.projectName()) {
                to.onAddDependency(from.projectName());
            }
        };

        this.onGraphRemoveDependency = (fromItemId, toItemId) => {
            let from = this.findItemById(fromItemId), to = this.findItemById(toItemId);
            if (from && to && from.projectName()) {
                to.onRemoveDependency(from.projectName());
            }
        };

        this.onAddSearchingItem = () => {
            let script = "projects.grep{ project ->\n\tproject.projectName in ['dubbo-service']\n}";
            this.inventory.viewModel.serviceObject.createSearchItem(JSON.stringify(this.toJson()), script, res => {
                let itemJson = res.responseJSON;
                if (itemJson) {
                    itemJson.id = generateUUID();
                    itemJson.searchScriptEditorOnFocus = true;
                    itemJson.expanded = true;
                    this.insertItem(itemJson);
                }
            });
        };

        this.onConfirm = () => {
            this.confirmedBy(this.inventory.viewModel.currentUser);
        };

        this.onRequestRefresh = () => {
            this.requestRefresh(this.requestRefresh() + 1);
        };
    }

    registerGlobalParameter(propertyName, parameterName) {
        this[propertyName] = ko.pureComputed({
            read: () => this.getItemsParameter(parameterName),
            write: (value) => this.setItemsParameter(parameterName, value),
            owner: this
        });
    }

    getItemsParameter(parameterName) {
        let values = [], items = this.items();
        for (let i = 0; i < items.length; i++) {
            let v = items[i].getParameterValue(parameterName);
            if (v !== undefined && values.indexOf(v) < 0) values.push(v);
        }
        if (values.length === 1) return values[0];
    }

    setItemsParameter(parameterName, parameterValue) {
        let items = this.items();
        for (let i = 0; i < items.length; i++) {
            items[i].setParameterValue(parameterName, parameterValue);
        }
    }

    createEmptyItemJson(projectJson) {
        return {
            id: projectJson.projectName,
            projectName: projectJson.projectName,
            project: projectJson,
            projectCount: 1,
            parameters: []
        };
    }

    getAllProjectNames() {
        let names = [], items = this.items();
        for (let i = 0; i < items.length; i++) {
            if (items[i].projectName()) {
                names.push(items[i].projectName())
            }
        }
        return names;
    }

    onItemDependencyChange(item) {
        let index = this.items.indexOf(item);
        if (index >= 0) {
            this.sortItemsInGroup(index);
        }
    }
}

class DeployItem extends ViewModel {
    /**
     * @param {DeployPlan} plan
     * @param json
     */
    constructor(plan, json) {
        super(plan.monitor);

        this.plan = plan;
        this.id = json.id || json.projectName || generateUUID();
        this.defaultSearchScript = "";

        this.project = ko.observable({});

        this.projectName = this.withMonitor(ko.observable());
        this.searchScript = ko.observable();
        this.searchScriptDescription = this.withMonitor(ko.observable());
        this.searchScriptExecutionError = ko.observable();
        this.searchScriptEditorOnFocus = ko.observable();
        this.projectCount = this.withMonitor(ko.observable());
        this.dependencies = this.withMonitor(ko.observableArray());
        this.tags = this.withMonitor(ko.observableArray());
        this.skipTags = this.withMonitor(ko.observableArray());
        this.servers = this.withMonitor(ko.observableArray());
        this.projectBranch = ko.observable();
        this.buildVersion = ko.observable();
        this.verifyMessage = ko.observable();
        this.parameters = ko.observableArray();
        this.expanded = ko.observable(false);
        this.confirmedBy = this.withMonitor(ko.observable());
        this.syncMessage = ko.observable();
        this.owner = ko.observable();

        this.addComputedProperties();
        this.registerEventHandlers();
        this.fromJson(json);
    }

    fromJson(json) {
        this.project(json.project);
        this.projectName(json.projectName);
        this.searchScript(json.searchScript);
        this.searchScriptDescription(json.searchScriptDescription);
        this.searchScriptExecutionError(json.searchScriptExecutionError);
        this.projectCount(json.projectCount);
        this.dependencies((json.dependencies || []).slice(0));
        this.tags((json.tags || json.project.tags).slice(0));
        this.servers((json.servers || json.project.servers).slice(0));
        this.skipTags((json.skipTags || json.project.selectedSkipTags).slice(0));
        this.verifyMessage(json.verifyMessage);
        this.confirmedBy(json.confirmedBy);
        this.syncMessage(json.syncMessage);
        this.owner(json.owner);

        this.parameters().conciliate(this.parameters, json.project.parameters,
                pj => new ProjectParameter(this, pj, json.parameters[pj.parameterName]),
                (p, pj) => p.fromJson(pj, json.parameters[p.parameterName()]));

        this.projectBranch(this.findParameter('project_branch'));
        this.buildVersion(this.findParameter('build_version'));
    }

    toJson() {
        return {
            id: this.id,
            project: this.project(),
            projectName: this.projectName(),
            searchScript: this.searchScript(),
            searchScriptDescription: this.searchScriptDescription(),
            searchScriptExecutionError: this.searchScriptExecutionError(),
            projectCount: this.projectCount(),
            dependencies: this.dependencies().slice(0),
            tags: this.tags().slice(0),
            skipTags: this.skipTags().slice(0),
            servers: this.servers().slice(0),
            verifyMessage: this.verifyMessage(),
            confirmedBy: this.confirmedBy(),
            syncMessage: this.syncMessage(),
            owner: this.owner(),
            parameters: this.parameters().map(p => p.toJson()).toMap()
        };
    }

    addComputedProperties() {
        this.searchScriptUI = ko.pureComputed({
            read: () =>  this.searchScript() || this.defaultSearchScript,
            write: value => {
                if (value !== this.defaultSearchScript) {
                    if (this.projectName()) { // first time
                        this.id = generateUUID();
                        this.projectName(null);
                    }
                    this.searchScript(value);
                    this.evaluateSearchScript();
                }
            },
            owner: this
        });

        this.totalRowspan = ko.pureComputed(() => this.expanded() ? 3 + (this.searchScriptUI() ? 1 : 0) + this.visibleParameters().length : 1);

        this.addDependencyOptions = ko.pureComputed(() => {
            return this.plan.items().filter(item =>
                item.projectName()
                && item.project().jobOrder === this.project().jobOrder
                && item !== this
                && this.dependencies().indexOf(item.projectName()) < 0
                && this.project().dependencies.indexOf(item.projectName()) < 0
            ).map(item => item.projectName());
        });

        this.itemTitle = ko.pureComputed(() => {
            if (this.projectName()) return this.projectName();
            if (this.searchScriptDescription()) return this.searchScriptDescription() + " (" + this.projectCount() + ")";
            return "contains " + this.projectCount() + " projects";
        });

        this.staticDependencies = ko.pureComputed(() => this.project().dependencies.intersect(this.plan.getAllProjectNames()));
        this.visibleParameters = ko.pureComputed(() => this.parameters().filter(p => !p.hiddenUI()));

        this.isConfirmed = ko.pureComputed({
            read: () => this.confirmedBy(),
            write: value => {
                this.confirmedBy(value ? this.plan.inventory.viewModel.currentUser : "");
            },
            owner: this
        });
    }
    
    registerEventHandlers() {
        this.onExpanded = () => {
            this.expanded(!this.expanded());
        };

        this.onRemove = () => {
            if (this.projectName()) {
                this.plan.removeItem(this.projectName());
            } else {
                let index = this.plan.items().indexOf(this);
                if (index >= 0) {
                    this.plan.items.splice(index, 1);
                }
            }
        };

        this.onEvaluateSearchScript = () => {
            if (this.searchScript()) {
                this.evaluateSearchScript();
            }
        };

        this.onAddDependency = (dependency) => {
            if (this.dependencies().indexOf(dependency) < 0 && this.project().dependencies.indexOf(dependency) < 0) {
                this.dependencies.push(dependency);
                this.plan.onItemDependencyChange(this);
            }
        };

        this.onRemoveDependency = (dependency) => {
            let i = this.dependencies().indexOf(dependency);
            if (i >= 0) {
                this.dependencies.splice(i, 1);
                this.plan.onItemDependencyChange(this);
            }
        };
    }

    beforePlanRemoveItem(item) {
        if (item.projectName() && this.dependencies().indexOf(item.projectName()) >= 0) {
            this.dependencies.splice(this.dependencies().indexOf(item.projectName()), 1);
        }
    }

    findParameter(parameterName) {
        let ps = this.parameters();
        for (let i = 0; i < ps.length; i++) {
            if (ps[i].parameterName() === parameterName) return ps[i];
        }
    }

    getParameterValue(parameterName) {
        let p = this.findParameter(parameterName);
        if (p) return p.value();
    }

    setParameterValue(parameterName, parameterValue) {
        let p = this.findParameter(parameterName);
        if (p) {
            p.value(parameterValue);
        }
    }

    toSummaryString() {
        let line = this.projectName();
        if (this.projectBranch()) {
            line += ": " + this.projectBranch().value();
        }
        return line;
    }

    fromSummaryString(args) {
        let projectBranch = args[0] || "";
        projectBranch = projectBranch.trim();
        if (this.projectBranch() && projectBranch !== "") {
            this.projectBranch().value(projectBranch);
        }
    }

    evaluateSearchScript() {
        if (!this.searchScript()) return;
        let planJson = this.plan.toJson();
        let selfIndex = planJson.items.findIndex(t => t.id === this.id);
        if (selfIndex >= 0) {
            planJson.items.splice(selfIndex, 1);
        }
        this.plan.inventory.viewModel.serviceObject.createSearchItem(JSON.stringify(planJson), this.searchScript(), res => {
            let itemJson = res.responseJSON;
            if (itemJson) {
                this.searchScriptExecutionError(itemJson.searchScriptExecutionError);
                if (!itemJson.searchScriptExecutionError) {
                    this.fromJson(itemJson);
                }
            }
        });
    }

    refresh() {
        if (this.searchScript()) {
            this.evaluateSearchScript();
        }
    }
}

class ProjectParameter extends ViewModel {
    /**
     * @param {DeployItem} item
     * @param json
     * @param value
     */
    constructor(item, json, value) {
        super(item.monitor);
        this.item = item;

        this.id = json.id || json.parameterName;
        this.parameterName = ko.observable();
        this.type = ko.observable();
        this.description = ko.observable();
        this.value = this.withMonitor(ko.observable());
        this.required = ko.observable();
        this.hidden = ko.observable(false);

        this.addComputedProperties();
        this.fromJson(json, value);
    }

    fromJson (json, value) {
        this.parameterName(json.parameterName);
        this.type(json.type);
        this.description(json.description);
        this.required(json.required);
        this.value(value === undefined ? json.defaultValue : value);
    }

    toJson() {
        return [this.parameterName(), this.value()];
    }

    addComputedProperties() {
        this.hiddenUI = ko.pureComputed(() => this.hidden());
        this.requiredUI = ko.pureComputed(() => this.required());
    }
}

class EntityChangeMonitor {
    constructor() {
        this.listeners = [];
        this._changed = false;
    }

    onchange(entity, field, value) {
        for (let f of this.listeners) {
            f(entity, field, value);
        }
        this._changed = true;
    }

    get changed() {
        return this._changed;
    }

    set changed(value) {
        this._changed = value;
    }
}

function initDeployPlanParameterScript(serviceObject, currentUser, environmentJson, deployInventoryJson, prdefinedInventoryListJson, deployPlanParameterWrapper) {
    let stringify = JSON.stringify;

    JSON.stringify = value => {
        let arrayToJSON = Array.prototype.toJSON;
        delete Array.prototype.toJSON;
        let r = stringify(value);
        Array.prototype.toJSON = arrayToJSON;
        return r;
    };

    registerCustomerBindings();
    registerExtenders();

    jQuery(() => {
        let deployPlanViewModel = new DeployPlanViewModel(new EntityChangeMonitor(), serviceObject, currentUser, environmentJson, deployInventoryJson, prdefinedInventoryListJson);
        window.deployPlanViewModel = deployPlanViewModel; // for debug
        ko.applyBindings(deployPlanViewModel, deployPlanParameterWrapper);
        let oldBuildFormTree = buildFormTree;

        buildFormTree = function (form) {
            let inventoryJson = deployPlanViewModel.deployInventory.toJson();
            jQuery("input[name=value]", deployPlanParameterWrapper).val(JSON.stringify(inventoryJson));
            return oldBuildFormTree(form);
        }
    });
}

function registerCustomerBindings() {
    registerCytoscapeBinding();
}

function registerExtenders() {
    ko.extenders.audit = (target, callback) => {
        target.subscribe(callback);
        return target;
    };
}

function registerCytoscapeBinding() {
    ko.bindingHandlers.cytoscape = {
        init: (element, valueAccessor) => {
            let options = ko.unwrap(valueAccessor());
            let data = ko.unwrap(options.data);

            function onRemoveNode(node) {
                if (options.onRemoveNode) {
                    options.onRemoveNode(node.id());
                }
            }

            function onAddDependency(fromNode, toNode) {
                if (options.onAddDependency) {
                    options.onAddDependency(fromNode.id(), toNode.id())
                }
            }

            function onRemoveDependency(edge) {
                if (options.onRemoveDependency) {
                    options.onRemoveDependency(edge.source().id(), edge.target().id());
                }
            }

            function convertCyElementDataToMap(a) {
                let map = {};
                for (let i = 0; i < a.length; i++) {
                    map[a[i].data.id] = a[i];
                }
                return map;
            }

            let oldValue = convertCyElementDataToMap(data);
            if (ko.isObservable(options.data)) {
                options.data.subscribe(value => {
                    let newValue = convertCyElementDataToMap(value || []);
                    let changes = getObjectDeepChanges(oldValue, newValue, 3);
                    let adding = [], removing = cy.collection();
                    for (let i = 0; i < changes.length; i++) {
                        let change = changes[i];
                        switch (change.type) {
                            case 'add-property':
                                adding.push(change.value);
                                break;
                            case 'remove-property':
                                removing = removing.union(cy.getElementById(change.property));
                                break;
                            case 'property-change':
                                cy.getElementById(change.property).json(newValue[change.property]);
                                break;
                        }
                    }

                    cy.add(adding);
                    removing.remove();

                    if (adding.length > 0 || !removing.empty()) {
                        cy.layout({
                            name: 'dependency-graph'
                        }).run();
                    }

                    oldValue = newValue
                });
            }

            let cy = cytoscape({
                container: element,
                elements: data,
                zoom: 1,
                pan: { x: 0, y: 0 },
                minZoom: 0.5,
                style: [
                    {
                        selector: ':parent',
                        style: {
                            'background-color': '#f9f9f9',
                            'min-width': '60px',
                            'min-height': '120px',
                            'compound-sizing-wrt-labels': 'exclude'
                        }
                    }, {
                        selector: ':parent node',
                        style: {
                            'background-color': '#aaa',
                            width: '15px',
                            height: '15px',
                            content: 'data(title)',
                            'font-size': '10px'
                        }
                    }, {
                        selector: ':parent node:selected',
                        style: {
                            'background-color': '#333'
                        }
                    }, {
                        selector: 'node.in-loop',
                        style: {
                            'background-color': '#f00'
                        }
                    }, {
                        selector: 'node.in-loop:selected',
                        style: {
                            'background-color': '#a00'
                        }
                    }, {
                        selector: 'edge',
                        style: {
                            'width': '2px',
                            'curve-style': 'bezier',
                            'target-arrow-shape': 'triangle',
                            'line-color': '#ccc',
                            'target-arrow-color': '#ccc'
                        }
                    }, {
                        selector: 'edge:selected',
                        style: {
                            'line-color': '#999',
                            'target-arrow-color': '#999'
                        }
                    }, {
                        selector: 'edge.in-loop',
                        style: {
                            'line-color': '#f00',
                            'target-arrow-color': '#f00'
                        }
                    }, {
                        selector: 'edge.in-loop:selected',
                        style: {
                            'line-color': '#a00',
                            'target-arrow-color': '#a00'
                        }
                    }
                ],

                layout: {
                    name: 'dependency-graph'
                }
            });

            cy.contextMenus({
                menuItems: [
                    {
                        id: 'remove',
                        content: 'remove',
                        tooltipText: 'remove',
                        selector: ':parent node, edge',
                        onClickFunction: function (event) {
                            let target = event.target;
                            if (target.isNode()) {
                                onRemoveNode(target);
                            } else {
                                onRemoveDependency(target);
                            }
                        }
                    }, {
                        id: 'reverse',
                        content: 'reverse',
                        tooltipText: 'reverse dependency',
                        selector: 'edge',
                        onClickFunction: function (event) {
                            let target = event.target;
                            onRemoveDependency(target);
                            onAddDependency(target.target(), target.source());
                        }
                    }
                ]
            });

            cy.on('select', ':parent node', event => {
                let node = event.target;
                let selectedNodes = cy.$(':parent node:selected'), added = false;
                for (let i = 0; i < selectedNodes.length; i++) {
                    let from = selectedNodes[i];
                    if (!from.same(node) && from.parent().same(node.parent())) {
                        onAddDependency(node, from);
                        added = true;
                    }
                }
                if (added) {
                    node.unselect();
                }
            })
        }
    };
}

Array.prototype.equalsIgnoreOrder = function(other) {
    let c1 = this, c2 = other;
    if (c1 === c2) return true;
    if (!c1 || !c2) return false;
    if (!Array.isArray(c1) || !Array.isArray(c2)) return false;
    if (c1.length !== c2.length) return false;
    for (let i = 0; i < c1.length; i++) {
        if (c2.indexOf(c1[i]) < 0) return false;
    }
    return true;
};

Array.prototype.toMap = function() {
    let map = {};
    for (let i = 0; i < this.length; i++) {
        map[this[i][0]] = this[i][1];
    }
    return map;
};

function getObjectDeepChanges(a, b, limit) {
    let changes = [], p;
    if (a === b) {
        // nothing to do
    } else if (limit === 0 || typeof a !== typeof b) {
        changes.push({type: 'change', from: a, to: b})
    } else if (typeof a === 'object') {
        for (p in a) {
            if (a.hasOwnProperty(p)) {
                if (b.hasOwnProperty(p)) {
                    let nestChanges = getObjectDeepChanges(a[p], b[p], limit - 1);
                    if (nestChanges.length > 0) {
                        changes.push({
                            type: 'property-change',
                            property: p,
                            changes: nestChanges
                        });
                    }
                } else {
                    changes.push({
                        type: 'remove-property',
                        property: p,
                        value: a[p]
                    });
                }
            }
        }
        for (p in b) {
            if (b.hasOwnProperty(p) && !a.hasOwnProperty(p)) {
                changes.push({
                    type: 'add-property',
                    property: p,
                    value: b[p]
                });
            }
        }
    } else if (a !== b) {
        changes.push({type: 'change', from: a, to: b});
    }

    return changes;
}

function formatDate(d) {
    return d.getFullYear() + "/" + digit2(d.getMonth() + 1) + "/" + digit2(d.getDate()) + " " +
        digit2(d.getHours()) + ":" + digit2(d.getMinutes()) + ":" + digit2(d.getSeconds());
}

function digit2(x) {
    x = '0' + x;
    return x.substr(x.length - 2, 2);
}

function generateUUID() {
    return Math.random().toString(36).substring(2) + new Date().getTime().toString(36);
}

class Graph {
    constructor() {
        this.nodesMap = {};
        this.keys = [];
    }

    node(name, data) {
        if (name in this.nodesMap) {
            this.nodesMap[name].data = data;
        } else {
            this.keys.push(name);
            this.nodesMap[name] = {
                name: name,
                data: data,
                prev: {},
                next: {}
            };
        }
    };

    removeNode(name) {
        let n = this.nodesMap[name], p;
        if (n) {
            for (p in n.next) {
                if (n.next.hasOwnProperty(p)) {
                    delete n.next[p].prev[name];
                }
            }
            for (p in n.prev) {
                if (n.prev.hasOwnProperty(p)) {
                    delete n.prev[p].next[name];
                }
            }
            delete this.nodesMap[name];
            this.keys.splice(this.keys.indexOf(name), 1);
        }
    };

    arc(from, to) {
        if (from in this.nodesMap && to in this.nodesMap) {
            let fromNode = this.nodesMap[from], toNode = this.nodesMap[to];
            fromNode.next[to] = toNode;
            toNode.prev[from] = fromNode;
        }
    };

    nodes() {
        return this.keys.map(n => this.nodesMap[n].data);
    };

    next(name) {
        let next = this.nodesMap[name].next, a = [];
        for (let p in next) {
            if (next.hasOwnProperty(p)) {
                a.push(next[p].data);
            }
        }
        return a;
    };

    prev(name) {
        let prev = this.nodesMap[name].prev, a = [];
        for (let p in prev) {
            if (prev.hasOwnProperty(p)) {
                a.push(prev[p].data);
            }
        }
        return a;
    };

    data(name) {
        return this.nodesMap[name].data;
    };

    clone() {
        let g = new Graph(), i, p;
        for (i = 0; i < this.keys.length; i++) {
            p = this.keys[i];
            g.node(p, this.nodesMap[p].data);
        }
        for (i = 0; i < this.keys.length; i++) {
            p = this.keys[i];
            let next = this.nodesMap[p].next;
            for (let q in next) {
                if (next.hasOwnProperty(q)) {
                    g.arc(p, q);
                }
            }
        }
        return g;
    };

    topology() {
        let g = this.clone(), path = [], loop = null;
        while(g.keys.length > 0) {
            let node = null;
            for (let i = 0; i < g.keys.length; i++) {
                let p = g.keys[i];
                let prev = g.nodesMap[p].prev, found = false;
                for (let q in prev) {
                    if (prev.hasOwnProperty(q)) {
                        found = true;
                    }
                }
                if (!found) {
                    node = g.nodesMap[p];
                    break;
                }
            }

            if (node) {
                g.removeNode(node.name);
                path.push(node.data);
            } else {
                loop = g.keys.map(key => g.nodesMap[key].data);
                path.push(g.nodesMap[g.keys[0]].data);
                g.removeNode(g.keys[0]);
            }
        }
        return {
            path: path,
            loop: loop || []
        };
    };
}

function DependencyGraphLayout(options) {
    let defaults = {
        fit: false, // whether to fit the viewport to the graph
        padding: 10, // padding used on fit
        boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
        avoidOverlap: false, // prevents node overlap, may overflow boundingBox if not enough space
        avoidOverlapPadding: 10, // extra spacing around nodes when avoidOverlap: true
        nodeDimensionsIncludeLabels: false, // Excludes the label when calculating node bounding boxes for the layout algorithm
        spacingFactor: undefined, // Applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
        condense: false, // uses all available space on false, uses minimal space on true
        rows: undefined, // force num of rows in the grid
        cols: undefined, // force num of columns in the grid
        position: node => {}, // returns { row, col } for element
        sort: undefined, // a sorting function to order the nodes; e.g. function(a, b){ return a.data('weight') - b.data('weight') }
        animate: false, // whether to transition the node positions
        animationDuration: 500, // duration of animation in ms if enabled
        animationEasing: undefined, // easing of animation if enabled
        ready: undefined, // callback on layoutready
        stop: undefined // callback on layoutstop
    };
    let opts = this.options = {}, i;
    for( i in defaults ){ opts[i] = defaults[i]; }
    for( i in options ){ opts[i] = options[i]; }

    this.run = function() {
        let i, group;
        let options = this.options;
        cy = options.cy;
        let allNodes = options.eles.nodes();
        let boxes = allNodes.orphans();

        if (cy.width() < 0 || cy.height() < 0) return this;

        let bb = options.boundingBox || { x1: options.padding / 2, y1: options.padding / 2, w: cy.width() - options.padding, h: cy.height() - options.padding };
        if( bb.x2 === undefined ){ bb.x2 = bb.x1 + bb.w; }
        if( bb.w === undefined ){ bb.w = bb.x2 - bb.x1; }
        if( bb.y2 === undefined ){ bb.y2 = bb.y1 + bb.h; }
        if( bb.h === undefined ){ bb.h = bb.y2 - bb.y1; }

        function getWidthFactor(nodeCount) {
            return Math.sqrt(nodeCount);
        }

        let groups = [], totalWidthFactor = 0;
        boxes.sort((e1, e2) => e1.data('order') - e2.data('order')).forEach(box => {
            let nodes = box.children(), widthFactor = getWidthFactor(nodes.length);
            groups.push({
                box: box,
                nodes: nodes,
                widthFactor: widthFactor
            });
            totalWidthFactor += widthFactor;
        });

        let layoutNotFinishedGroups = groups.slice();

        let layouts = [], left = bb.x1;
        for (i = 0; i < groups.length; i++) {
            group = groups[i];
            let box = group.box,
                nodes = group.nodes,
                w = group.widthFactor / totalWidthFactor * bb.w,
                border = {
                    x1: left ,
                    y1: bb.y1,
                    w: w,
                    h: bb.h
                },
                layout;

            let diff = (border.w / border.h - 2) * border.h;
            if (diff > 0) {
                border.w -= diff;
                border.x1 += diff / 2;
            }
            diff = (border.h / border.w - 1) * border.w;
            if (diff > 0) {
                border.h -= diff;
                border.y1 += diff / 2;
            }

            group.border = border;

            let ly = {
                boundingBox: border,
                padding: 5,
                fit: true,
                animate: false,
                stop: () => refineLayout(group)
            };

            if (nodes.length <= 6) {
                ly.name = 'circle';
            } else {
                ly.name ='cola';
                ly.randomize = true;
                ly.flow = { axis: 'x', minSeparation: 10 }
            }

            group.layout = nodes.layout(ly);
            layouts.push(group.layout);

            left += w;
        }

        for (i = 0; i < layouts.length; i++) {
            layouts[i].run();
        }

        function refineLayout(group) {
            layoutNotFinishedGroups.splice(layoutNotFinishedGroups.indexOf(group));

            if (layoutNotFinishedGroups.length === 0) {
                cy.pan({x: 0, y: 0});
                cy.zoom(1);

                let i;
                for (i = 0; i < groups.length; i++) {
                    postfixGroupLayout(groups[i]);
                }

                for (i = 0; i < groups.length; i++) {
                    postfixGroupLayout(groups[i]);
                }
            }
        }

        function postfixGroupLayout(group) {
            let border = group.border,
                box = group.box,
                layout = group.layout;

            let centerX = border.x1 + border.w / 2,
                centerY = border.y1 + border.h / 2,
                boxPos = box.position(),
                dispX = boxPos.x - centerX,
                dispY = boxPos.y - centerY;

            if (Math.abs(dispX) > 1 || Math.abs(dispY) > 1) {
                box.children().layoutPositions(layout, options, function (e) {
                    let p = e.position();
                    return {
                        x: p.x - dispX,
                        y: p.y - dispY
                    };
                });
            }
        }

        return this;
    };
}

let cy;

cytoscape('layout', 'dependency-graph', DependencyGraphLayout);

