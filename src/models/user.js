export default {
  namespace: 'user',

  state: {
    currentUser: {}
  },

  effects: {
    *getCurrentUser({ payload }, { put }) {
      yield put({
        type: 'save',
        payload: { currentUser: {name: "nick"}},
      });
    },
  },

  reducers: {
    save(state, action) {
      return {
        ...state,
        ...action.payload,
      };
    }
  }
};
