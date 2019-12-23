function TestCaseSelectionModel() {
    var self = this;

    self.testCases = ko.observableArray([]);

    self.getFreshCategories = function () {
        var categories = JSON.parse(JSON.stringify(self.categories));
        categories.forEach(function (category) {
            category.testCases.forEach(function (testCase) {
                testCase.parameters.forEach(function (param) {
                    param.value = ko.observable();
                    param.defaultValue = self.getParameterDefaultValue(param);
                });
            });
        });
        return categories;
    }

    self.addCase = function () {
        if (!self.categories || self.categories.length < 1) {
            alert('正在拉取数据，请稍后再重试')
            return false;
        }
        self.testCases.push({
            categories: self.getFreshCategories(),
            selectedCategory: ko.observable(),
            selectedTestCase: ko.observable()
        });
    }

    self.hasOptions = function (param) {
        return param.options && param.options.length > 0;
    }

    self.isValid = function () {
        var selectedCases = self.getSelectedTestCases();
        if (selectedCases.length < 1) return false;
        return selectedCases.every(function (testCase) {
            return testCase.parameters.every(function (param) {
                return !self.hasError(param);
            })
        })
    }

    self.hasError = function (param) {
        var value = param.value();
        var isInValidValue = value === undefined || value === '';
        return param.required && param.type !== 'java.lang.Boolean' && isInValidValue;
    }

    self.getSelectedTestCases = function () {
        return self.testCases()
            .filter(function (item) {
                return item.selectedTestCase();
            })
            .map(function (item) {
                return item.selectedTestCase();
            });
    }

    self.getTestCasesResult = function (testCases) {
        return testCases.map(function (testCase) {
            var parameters = testCase.parameters.map(function (param) {
                var paramTemp = Object.assign({}, param);
                var value = param.value();
                paramTemp.value = value === undefined ? param.defaultValue : value;
                delete paramTemp.defaultValue;
                delete paramTemp.tips;
                delete paramTemp.options;
                return paramTemp;
            })
            var testCaseTemp = Object.assign({}, testCase);
            testCaseTemp.parameters = parameters;
            return testCaseTemp;
        });
    }

    self.getParameterDefaultValue = function (param) {
        var defaultValue;
        switch (param.type) {
            case 'java.lang.String':
                defaultValue = '';
                break;
            case 'java.lang.Integer':
                defaultValue = 0;
                break;
            case 'java.lang.Boolean':
                defaultValue = false;
                break;
        }

        return defaultValue;
    }

    self.testInfo = ko.computed(function () {
        var selectedCases = self.getSelectedTestCases();
        var testCaseResult = self.getTestCasesResult(selectedCases);
        var testInfo = JSON.stringify(testCaseResult, null, 2);
        return testInfo;
    })

    self.removeCase = function (item) {
        self.testCases.remove(item);
    }

    self.loadTestCases = function (callback) {
        serviceScript.getTestCases(function (res) {
            if (res.status != 200) {
                alert('获取测试列表失败，请稍后重试');
            }
            try {
                self.categories = JSON.parse(res.responseJSON);
                if(callback) {
                    callback();
                }
            } catch (e) {
                console.log(e);
                console.log('parse testCases failed...');
            }
        })
    }

    jQuery(document).on('submit', "form[name=parameters]", function (e) {
        if (!self.isValid()) {
            e.preventDefault();
            return false;
        }
    })
}

var model = new TestCaseSelectionModel();
ko.applyBindings(model);
model.loadTestCases(function(){
    model.addCase();
});