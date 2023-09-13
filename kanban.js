(function ($, W) {
    String.prototype.ucfirst = function () {
        return this.charAt(0).toUpperCase() + this.slice(1);
    };

    var _dragSubstituteDom = $('<div>', {
        'class': 'kanban-list-card-detail substitute',
        width: outerWidth,
        height: outerHeight
    });
    var _dictionnary = {};
    var _currentLanguage;
    var _dragAndDropManager = {
        prependOnly: false,
        onCardDrop(self, Context, notify) {
            if (typeof notify !== 'boolean') {
                notify = true;
            }
            var settings = Context.data('settings');
            var oldColumn = self.data('column');
            var newColumn = self.parents('.kanban-list-wrapper').data('column');
            var data = self.data('datum');
            self.attr('data-column', newColumn);
            self.data('column', newColumn);
            self.find('.kanban-list-card-edit').attr('data-column', newColumn).data('column', newColumn);
            self.find('.kanban-list-card-switch').attr('data-column', newColumn).data('column', newColumn);
            var columnKanbanDoms = $('.kanban-list-card-detail[data-column="' + newColumn + '"]');
            var newIndex = columnKanbanDoms.index(self);
            var newDataMatrix = $.extend({}, Context.data('matrix'));

            var dataIndex = newDataMatrix[oldColumn].findIndex(function (datum) {
                return datum.id === data.id;
            });
            data.header = newColumn;
            data.position = newIndex;
            self.data('datum', data);
            newDataMatrix[oldColumn].splice(dataIndex, 1);

            if (newIndex >= newDataMatrix[newColumn].length) newDataMatrix[newColumn].push(data);
            else newDataMatrix[newColumn].splice(newIndex, 0, data);


            var oldDataList = newDataMatrix[oldColumn];
            for (var i = 0; i < oldDataList.length; i++) {
                if (typeof oldDataList[i].position === 'number') oldDataList[i].position = i;
            }
            var newDataList = newDataMatrix[newColumn];
            for (var i = 0; i < newDataList.length; i++) {
                if (typeof newDataList[i].position === 'number') newDataList[i].position = i;
            }
            newDataMatrix[oldColumn] = oldDataList;
            newDataMatrix[newColumn] = newDataList;
            var filter = Context.data('filter');
            Context.data('matrix', newDataMatrix);
            newDataMatrix = filterMatrixBy(newDataMatrix, filter);

            Context.find(`.card-counter[data-column=${oldColumn}]`).text(newDataMatrix[oldColumn].length);
            Context.find(`.card-counter[data-column=${newColumn}]`).text(newDataMatrix[newColumn].length);
            if (typeof settings.onCardDrop === 'function' && notify) settings.onCardDrop({ data, origin: oldColumn, target: newColumn }, { origin: oldDataList, target: newDataList });
        }
    }

    function moveCard(Context, cardDom, from, to, at) {
        var listCardContainerDom = Context.find('.kanban-list-wrapper[data-column=' + to + '] .kanban-list-cards');
        var elementNumber = listCardContainerDom.children().length;
        var isSameColumn = from === to;
        if (!isSameColumn && elementNumber === at || isSameColumn && elementNumber - 1 === at) {
            listCardContainerDom.append(cardDom);
        } else {
            listCardContainerDom.children().eq(at).before(cardDom);
        }
    }

    function addCardClicked() {
        var self = $(this);
        var Context = self.data('context');
        var settings = Context.data('settings');
        var textArea = self.parents('.card-composer').find('.js-card-title');
        var matrix = $.extend({}, Context.data('matrix'));
        if (textArea.val()) {
            var column = self.data('column');
            switch (self.data('action')) {
                case 'update':
                    var index = parseInt(self.data('target'), 10);
                    var cardDetailDom = Context.find('.kanban-list-card-detail[data-column=' + column + ']').eq(index);
                    $(`[data-column="${column}"] .kanban-list-card-title`).eq(index).text(textArea.val());
                    var oldValue = cardDetailDom.data('datum');
                    var newValue = $.extend({}, oldValue);
                    newValue.title = textArea.val();
                    var realIndex = matrix[column].findIndex(function (data) {
                        return data.id === oldValue.id;
                    });
                    matrix[column][realIndex] = newValue;
                    Context.data('matrix', matrix);

                    var filter = Context.data('filter');
                    matrix = filterMatrixBy(matrix, filter);
                    if (typeof settings.onCardUpdate === 'function') settings.onCardUpdate({ oldValue, newValue });
                    buildCards(Context, matrix);
                    bindDragAndDropEvents(Context, _dragAndDropManager);
                    if (typeof settings.onRenderDone === 'function') settings.onRenderDone();
                    break;
                case 'insert':
                    var cardsContainerDom = $(`#kanban-wrapper-${column} .kanban-list-cards`);
                    var newData = {
                        id: (new Date).getTime(),
                        header: column,
                        title: textArea.val(),
                        position: cardsContainerDom.children().length - 1,
                        editable: settings.editable,
                        html: false,
                        contributors: [],
                        actions: []
                    };
                    matrix[column].push(newData);
                    Context.data('matrix', matrix);

                    var filter = Context.data('filter');
                    var filteredMatrix = filterMatrixBy(matrix, filter);
                    var index = filteredMatrix[column].findIndex(function (data) {
                        return data.id === newData.id;
                    });
                    if (index >= 0) {
                        cardsContainerDom.append(buildCard({
                            data: newData,
                            settings: settings
                        }));
                        Context.find(`.card-counter[data-column=${column}]`).text(filteredMatrix[column].length);
                    }

                    if (typeof settings.onCardInsert === 'function') settings.onCardInsert(newData);
                    bindDragAndDropEvents(Context, _dragAndDropManager);
                    if (typeof settings.onRenderDone === 'function') settings.onRenderDone();
                    break;
            }
            $('.js-cancel').trigger('click');
            Context.find('.kanban-list-wrapper').trigger('editor-close');
            $('.kanban-overlay.active').trigger('click');
        }
    }

    function filterMatrixBy(matrix, criterias) {
        var temporaryMatrix = {};
        var column;
        if (typeof criterias.columns !== 'undefined' && Array.isArray(criterias.columns)) {
            for (column in matrix) {
                if (criterias.columns.include(column)) temporaryMatrix[column] = matrix[column];
            }
            matrix = $.extend(true, {}, temporaryMatrix);
            temporaryMatrix = {};
        }
        if (typeof criterias.card !== 'undefined' && criterias.card.length > 0) {
            for (column in matrix) {
                temporaryMatrix[column] = matrix[column].filter(function (data) {
                    var regex = new RegExp(criterias.card, 'ig');
                    return data.title.match(regex);
                });
            }
            matrix = $.extend(true, {}, temporaryMatrix);
            temporaryMatrix = {};
        }
        if (typeof criterias.contributors !== 'undefined') {
            for (column in matrix) {
                temporaryMatrix[column] = matrix[column].filter(function (data) {
                    return typeof data.contributors !== 'undefined' && data.contributors.some(function (someContributor) {
                        return typeof someContributor.id !== 'undefined' && (Array.isArray(criterias.contributors) && criterias.contributors.includes(someContributor.id) || criterias.contributors === someContributor.id);
                    });
                });
            }
            matrix = $.extend(true, {}, temporaryMatrix);
            temporaryMatrix = {};
        }
        return matrix;
    }

    function loadTranslation(language, from) {
        _currentLanguage = language;
        return new Promise(function (resolve) {
            $.getJSON(`${typeof from === 'string' ? from : ''}language/${language}.json`, function (data) {
                _dictionnary[language] = data;
                resolve();
            })
        });
    }

    function mediaQueryAndMaxWidth(container, width) {
        if (container.outerWidth() <= width) {
            container.find('.kanban-list-card-edit, .kanban-list-card-switch').css({
                'display': 'inline-block'
            });
        } else {
            container.find('.kanban-list-card-edit, .kanban-list-card-switch').css('display', '');
        }
    }

    function translate(keyword) {
        if (_dictionnary[_currentLanguage] && _dictionnary[_currentLanguage][keyword]) return _dictionnary[_currentLanguage][keyword];
        return keyword;
    }

    function isPointerInsideOf(element, position) {
        var bcr = element.getBoundingClientRect();
        var groupX = position.x >= bcr.x && position.x <= bcr.x + bcr.width;
        var groupY = position.y >= bcr.y && position.y <= bcr.y + bcr.height;
        return groupX && groupY;
    }

    function buildNewCardInput(Context, column) {
        var wrapperDom = Context.find('#kanban-wrapper-' + column);
        var settings = Context.data('settings');
        html = `
            <div class="card-composer">
                <div class="list-card js-composer">
                    <div class="list-card-details u-clearfix">
                        <textarea class="list-card-composer-textarea js-card-title" dir="auto" placeholder="${translate('enter a title for this card')}…"></textarea>
                    </div>
                </div>
                <div class="cc-controls u-clearfix">
                    <div class="cc-controls-section">
                        <input class="nch-button nch-button--primary confirm mod-compact js-add-card" type="submit" value="${translate('add a card').ucfirst()}" data-column="${column}" data-action="insert">
                        <a class="icon-lg icon-close dark-hover js-cancel" href="!#">
                            <span class="fa fa-times"></span>
                        </a>
                    </div>
                </div>
            </div>
            `;
        if (typeof settings.onCreateCardOpen === 'function') settings.onCreateCardOpen(column);
        wrapperDom.off('editor-close');
        wrapperDom.on('editor-close', function () {
            wrapperDom.find('.card-composer').remove();
            wrapperDom.find('.kanban-new-card-button').css('display', '');
            Context.off('click', checkCloseEditor);
        });
        function checkCloseEditor(event) {
            var cardComposerDom = wrapperDom.find('.card-composer');
            var targetDom = $(event.target);
            if (!targetDom.get(0).isSameNode(cardComposerDom.get(0)) && targetDom.parents('.card-composer').length === 0) {
                wrapperDom.trigger('editor-close');
            }
        }
        Context.on('click', checkCloseEditor);
        Context.find('.list-card-composer-textarea').on('input', function () {
            var self = $(this);
            self.height(0);
            var scrollHeight = self.prop('scrollHeight');
            if (scrollHeight >= 100) self.css('overflow-y', 'auto');
            else self.css('overflow', 'hidden');
            scrollHeight = Math.max(Math.min(scrollHeight, 100), 54);
            self.height(scrollHeight);
        });
        wrapperDom.find('.kanban-new-card-button').hide();
        wrapperDom.on('click', '.js-cancel', function (event) {
            event.preventDefault();
            wrapperDom.trigger('editor-close');
        });
        return html;
    }

    function getDataFromCard(Context, cardDom) {
        var filter = Context.data('filter');
        var column = cardDom.data('column');
        var index = cardDom.parents('.kanban-list-cards').find('.kanban-list-card-detail').index(cardDom);
        var matrix = Context.data('matrix');
        var filteredMatrix = filterMatrixBy(matrix, filter);
        return filteredMatrix[column][index];
    }

    function buildContributorsDropdown(contributorsList) {
        var html = `
                <ul class="contributor-list">
                    ${contributorsList.map(function (oneContributor) {
            var dataList = typeof oneContributor.data === 'object' ? oneContributor.data : {};
            var dataString = '';
            $.each(dataList, function (key, value) {
                dataString += `data-${key.replace(/A-Z/g, function (match) {
                    return `-${match.toLowerCase()}`;
                })}="${value.toString().replace(/"/g, '&quot;')}" `;
            });
            if (dataString.length > 0) dataString = dataString.substring(0, dataString.length - 1);
            return `
                <li class="contributor-info" ${dataString}>
                    <div class="contributor-image">
                        <img src="${oneContributor.image}" alt="${oneContributor.name}" />
                    </div>
                    <p class="contributor-name">${oneContributor.name}</p>
                </li>
            `;
        }).join('')
            }
                </ul>
            `;
        var containerDom = $('<div>', {
            'class': 'contributor-container',
            html
        });
        return containerDom;
    }

    function buildCard(options) {
        var data = options.data;
        var settings = options.settings;
        var listCardDetailContainer = $('<div>').attr('data-column', data.header).attr('data-id', data.id).addClass('kanban-list-card-detail').data('datum', data);

        var listCardDetailText = $('<span>', {
            'class': 'kanban-list-card-title'
        });

        if (data.html) listCardDetailText.html(data.title);
        else listCardDetailText.text(data.title);

        var listCardDetailSwitch = $('<button>', {
            'class': 'kanban-list-card-switch',
            html: '<span class="fa fa-arrows-h"></span>',
            'data-column': data.header
        });
        var listCardDetailEdit = $('<button>', {
            'class': 'kanban-list-card-edit',
            html: '<span class="fa fa-pencil"></span>',
            'data-column': data.header
        });
        var cardActionDom = $('<div>', {
            'class': 'kanban-list-card-action'
        });
        var cardFooterDom = $('<div>', {
            'class': 'kanban-footer-card'
        });
        var contributorDom = $('<button>', {
            'class': 'contributors-preview',
            html: `${data.contributors.length} <span class="fa fa-users"></span>`
        });
        if (settings.editable && data.editable) cardActionDom.append(listCardDetailEdit);
        if (data.actions.length) {
            $.each(data.actions, function (_, oneAction) {
                var html = '';
                if (typeof oneAction.icon === 'undefined' && typeof oneAction.badge === 'undefined') return true;
                if (settings.actionConditionEnabled && typeof oneAction.hideCondition !== 'undefined') {
                    var interrupt = false;
                    for (var key in oneAction.hideCondition) { if (typeof oneAction[key] !== 'undefined' && oneAction[key].toString() === oneAction.hideCondition[key].toString()) interrupt = true; }
                    if (interrupt) return true;
                }
                html = ['string', 'number'].includes(typeof oneAction.badge) ? oneAction.badge : '';
                html = html + (typeof oneAction.icon === 'string' ? `${(html.length > 0 ? ' ' : '')} <span class="${oneAction.icon}"></span>` : '');
                var actionDom = $('<button>', {
                    'class': 'card-action',
                    html
                });
                if (typeof oneAction.className !== 'undefined' && oneAction.className.length > 0) actionDom.addClass('custom').addClass(oneAction.className);
                // Spécificité communecter
                if (oneAction.bstooltip) {
                    actionDom.attr('data-toggle', 'tooltip').attr('data-placement', oneAction.bstooltip.position).attr('data-original-title', oneAction.bstooltip.text.replace(/"/g, '&quot;'));
                    actionDom.addClass('tooltips');
                }
                // Spécificité communecter
                cardFooterDom.append(actionDom);
                if (oneAction.action) actionDom.data('action', oneAction.action);
            });
        }
        cardFooterDom.append(contributorDom);
        cardActionDom.append(listCardDetailSwitch);
        listCardDetailContainer
            .append(listCardDetailText)
            .append(cardActionDom)
            .append(cardFooterDom);
        if (data.contributors.length) {
            listCardDetailContainer.append(buildContributorsDropdown(data.contributors))
        }
        return listCardDetailContainer;
    }

    function buildCardEditor(options) {
        var data = options.data;
        var position = options.position;
        var size = options.size;
        var container = $('<div>', {
            'class': 'card-composer',
            css: {
                position: 'fixed',
                top: position.y,
                left: position.x,
                width: size.width
            }
        });
        container.html(`
        <div class="list-card js-composer">
            <div class="list-card-details u-clearfix">
                <textarea class="list-card-composer-textarea js-card-title" dir="auto" placeholder="${translate('enter a title for this card')}…">${data.title}</textarea>
            </div>
        </div>
        <div class="cc-controls u-clearfix">
            <div class="cc-controls-section">
                <input class="nch-button nch-button--primary confirm mod-compact js-add-card" type="submit" value="${translate('save').ucfirst()}" data-action="update" data-column="${options.column}" data-target="${options.index}">
            </div>
        </div>
        `);
        return container;
    }

    function getDragAfterElement(container, y) {
        const draggableElements = Array.from(container.querySelectorAll('.kanban-list-card-detail:not(.dragging)'));

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect()
            const offset = y - box.top - box.height / 2
            if (offset < 0 && offset > closest.offset) {
                return {
                    offset: offset,
                    element: child
                }
            } else {
                return closest
            }
        }, {
            offset: Number.NEGATIVE_INFINITY
        }).element
    }

    function bindDragAndDropEvents(Context, events) {
        var diffX = 0, diffY = 0, outerWidth = 0, outerHeight = 0, width = 0, height = 0;
        var dragstart = false, dragover = false;

        function mousedown(event) {
            if (event.button === 2) return false;
            var bcr = this.getBoundingClientRect();
            diffX = event.clientX - bcr.x;
            diffY = event.clientY - bcr.y;
            outerWidth = $(this).outerWidth();
            outerHeight = $(this).outerHeight();
            width = $(this).width();
            height = $(this).height();
            dragstart = true;
            $(this).off('mouseup').one('mouseup', mouseup);
            $(document).off('mousemove').on('mousemove', '.kanban-list-card-detail', function (event) {
                mousemove(event.originalEvent, this);
            });
        }
        function mousemove(event, target) {
            if (!dragstart) return;
            var self = $(target);
            self.removeClass('active-card');
            if (!self.hasClass('dragging')) {
                var bcr = self.get(0).getBoundingClientRect();
                var cardDetailDom = $('.kanban-list-card-detail[data-column="' + self.data('column') + '"]');
                oldIndex = cardDetailDom.index(self);
                self.data('index', oldIndex);
                dragstart = true;
                self.addClass('dragging').css('position', 'fixed');
                self.width(width).height(height);
                self.css({
                    top: bcr.y,
                    left: bcr.x
                });
                _dragSubstituteDom.css({
                    width: outerWidth,
                    height: outerHeight
                });
                self.detach();
                Context.append(self);
                dragover = true;
                checkDragOver({ x: bcr.x, y: bcr.y });
                self.off('mouseleave').on('mouseleave', mouseup);
            }
            if (dragover) {
                self.css({
                    left: event.clientX - diffX,
                    top: event.clientY - diffY,
                });
                checkDragOver({ x: event.clientX, y: event.clientY });
            }
        }
        function mouseup() {
            var self = $(this);
            self.off('mouseup');
            self.off('mouseleave');
            $(document).off('mousemove');
            if (!dragstart) return;
            dragstart = false;
            if (!dragover) return;
            dragover = false;
            var bcr = _dragSubstituteDom.get(0).getBoundingClientRect();
            self.animate({
                top: bcr.y,
                left: bcr.x
            }, {
                easing: 'easeOutQuad',
                duration: 200,
                complete() {
                    self.removeClass('dragging').css({ position: '', top: '', left: '', width: '', height: '', transform: '' });
                    _dragSubstituteDom.after(self);
                    _dragSubstituteDom.detach();
                    if (typeof events.onCardDrop === 'function') events.onCardDrop(self, Context);
                    diffX = 0, diffY = 0, outerWidth = 0, outerHeight = 0, width = 0, height = 0;
                }
            });
        }

        function checkDragOver(position) {
            Context.find('.kanban-list-content').each(function () {
                if (isPointerInsideOf(this, position)) {
                    var containerVanillaDom = this.querySelector('.kanban-list-cards');
                    var afterElementVanillaDom = getDragAfterElement(containerVanillaDom, position.y);
                    if (afterElementVanillaDom == null) $(containerVanillaDom).append(_dragSubstituteDom);
                    else if (events.prependOnly) $(this).find('.kanban-list-card-detail:first-child').before(_dragSubstituteDom);
                    else $(afterElementVanillaDom).before(_dragSubstituteDom);
                }
            });
        }

        Context.find('.kanban-list-card-detail').each(function () {
            $(this).off('mousedown').off('mouseup', mouseup);
            $(document).off('mousemove');
        });
        Context.find('.kanban-list-card-detail').each(function () {
            $(this).on('mousedown', mousedown);
        });
    }

    function buildCardMoveContext(headers, selectedData, matrixData) {
        var matrixLengthInHeader = matrixData[selectedData.header].length;
        var indexOfData = matrixData[selectedData.header].indexOf(selectedData);
        var moveCardContext = $('<div>', {
            'class': 'kanban-move-card'
        });
        moveCardContext.empty().html(`
            <h2 class="kanban-card-move-header">${translate('move the card').ucfirst()}</h2>
            <label class="kanban-card-move-label">${translate('list').ucfirst()}</label>
            <div class="select">
                <select class="kanban-target-choice" name="list-map">
                    ${headers.map(function (oneHeaderMap) { return `<option value="${oneHeaderMap.id}" ${oneHeaderMap.id === selectedData.header ? 'selected="selected"' : ''}>${oneHeaderMap.label} ${oneHeaderMap.id === selectedData.header ? `(${translate('current')})` : ''}</option>`; }).join('')}
                </select>
            </div>
            <label class="kanban-card-move-label">${translate('position').ucfirst()}</label>
            <div class="select">
                <select class="kanban-target-choice" name="position-map">
                    ${Array.from({ length: matrixLengthInHeader }, (_, index) => index).map(oneArrayMap => `<option value="${oneArrayMap}" ${oneArrayMap === indexOfData ? 'selected="selected"' : ''}>${oneArrayMap + 1} ${oneArrayMap === indexOfData ? `(${translate('current')})` : ''}</option>`).join('')}
                </select>
            </div>
            <input class="nch-button nch-button--primary wide js-submit" type="submit" value="${translate('move').ucfirst()}">
        `);

        moveCardContext.on('change', '[name=list-map]', function () {
            var newLength = matrixData[this.value].length;
            moveCardContext.find('[name=position-map]').empty().html(`
                ${Array.from({ length: this.value === selectedData.header ? newLength : newLength + 1 }, (_, index) => index).map(oneArrayMap => `<option value="${oneArrayMap}" ${this.value === selectedData.header && oneArrayMap === indexOfData ? 'selected="selected"' : ''}>${oneArrayMap + 1} ${this.value === selectedData.header && oneArrayMap === indexOfData ? `(${translate('current')})` : ''}</option>`).join('')}
            `);
        });
        return moveCardContext;
    }

    function addColumns(Context, headers) {
        $.each(headers, function (_, oneHeader) {
            var matrix = $.extend({}, Context.data('matrix'));
            var settings = Context.data('settings');
            function findHeader(oneHeaderFind) {
                return oneHeaderFind.id === oneHeader.id;
            }
            if (typeof matrix[oneHeader.id] === 'undefined' || !Array.isArray(matrix[oneHeader.id])) matrix[oneHeader.id] = [];
            if (typeof settings.headers.find(findHeader) === 'undefined') settings.headers.push(oneHeader);
            Context.data('matrix', matrix);
            Context.data('settings', settings);
        });
    }

    function addData(Context, data) {
        var settings = Context.data('settings');
        var compiledDataList = data.map(function (datumMap) {
            var defaultDadum = {
                id: Math.floor(Math.random() * Date.now()),
                html: false,
                editable: settings.editable,
                actions: [],
                contributors: []
            };
            return $.extend(true, {}, defaultDadum, datumMap);
        });
        $.each(compiledDataList, function (_, dataLine) {
            var matrix = $.extend({}, Context.data('matrix'));
            if (typeof matrix[dataLine.header] === 'undefined' || !Array.isArray(matrix[dataLine.header])) matrix[dataLine.header] = [];
            if (typeof dataLine.position === 'number') {
                if (dataLine.position >= matrix[dataLine.header].length || dataLine.position < 0) matrix[dataLine.header].push(dataLine);
                else matrix[dataLine.header].splice(dataLine.position, 0, dataLine);
            } else {
                var last = matrix[dataLine.header].pop();
                if (typeof last === 'undefined') matrix[dataLine.header].push(dataLine);
                else if (typeof last.position === 'number') {
                    if (matrix[dataLine.header].length < last.position) matrix[dataLine.header].push(dataLine, last);
                    else matrix[dataLine.header].push(last, dataLine);
                } else matrix[dataLine.header].push(last, dataLine);
            }
            Context.data('matrix', matrix);
        });
    }

    function deleteData(Context, coordinates) {
        var matrix = $.extend({}, Context.data('matrix'));
        if (typeof coordinates === 'object' && typeof coordinates.index !== 'undefined') {
            matrix[coordinates.column].splice(coordinates.index, 1);
        } else if (typeof coordinates === 'object' && typeof coordinates.id !== 'undefined') {
            var index = matrix[coordinates.column].findIndex(function (data) {
                return data.id === coordinates.id;
            });
            matrix[coordinates.column].splice(index, 1);
        } else {
            for (var column in matrix) {
                var index = matrix[column].findIndex(function (data) {
                    return data.id === coordinates;
                });
                if (index >= 0) {
                    matrix[column].splice(index, 1);
                    break;
                }
            }
        }
        Context.data('matrix', matrix);
    }

    function buildColumns(Context) {
        var settings = Context.data('settings');
        var matrix = Context.data('matrix');
        var filter = Context.data('filter');
        matrix = filterMatrixBy(matrix, filter);
        $.each(matrix, function (oneHeaderKey) {
            if (Context.find(`kanban-list-wrapper[data-column=${oneHeaderKey}]`).length > 0) return false;
            var oneHeader = settings.headers.find(oneHeaderFind => oneHeaderFind.id === oneHeaderKey);
            if (typeof oneHeader === 'undefined') return true;
            var kanbanListWrapperDom = $('<div>', {
                'class': 'kanban-list-wrapper',
                id: 'kanban-wrapper-' + oneHeader.id,
                'data-column': oneHeader.id
            });
            var kanbanListContentDom = $('<div>', {
                'class': 'kanban-list-content',
            });
            var kanbanListHeaderDom = $('<div>', {
                'class': 'kanban-list-header',
                html: `<span class="column-header-text">${oneHeader.label}</span><input class="column-header-editor" value="${oneHeader.label}" type="text">${settings.showCardNumber ? `<span class="card-counter-container"> (<span data-column="${oneHeader.id}" class="card-counter">0</span>)</span>` : ''}`
            });
            var actionDropdownDom = $('<div>', {
                'class': 'kanban-action-dropdown',
                html: `
                    <button class="dropdown-trigger kanban-themed-button"><span class="fa fa-ellipsis-h"></span></button>
                    <ul class="dropdown-list">
                        <li class="dropdown-item" data-target="column-rename">${translate('rename this column').ucfirst()}</li>
                        <li class="dropdown-item" data-target="add-card">${translate('add a new card').ucfirst()}</li>
                    </ul>
                `
            });
            var listCardDom = $('<div>', {
                'class': 'kanban-list-cards'
            });
            var composerContainerDom = $('<div>', {
                'class': 'kanban-composer-container'
            });
            var addNewCardButtonDom = $('<button>', {
                'class': 'kanban-new-card-button',
                html: `<span class="fa fa-plus"></span> ${translate('add a new card').ucfirst()}`,
                data: {
                    column: oneHeader.id
                }
            });
            kanbanListHeaderDom.append(actionDropdownDom);
            if (settings.editable) composerContainerDom.append(addNewCardButtonDom);
            kanbanListContentDom
                .append(kanbanListHeaderDom)
                .append(listCardDom)
                .append(composerContainerDom);
            Context.find('.kanban-container').append(kanbanListWrapperDom.append(kanbanListContentDom));
        })
    }

    function buildCards(Context, matrix) {
        var settings = Context.data('settings');
        if (typeof matrix === 'undefined') { matrix = $.extend({}, Context.data('matrix')); }
        $.each(matrix, function (column, oneMatrixData) {
            var listCardDom = Context.find('#kanban-wrapper-' + column + ' .kanban-list-cards');
            Context.find(`.kanban-list-header .card-counter[data-column=${column}]`).text(oneMatrixData.length);
            listCardDom.children().remove();
            $.each(oneMatrixData, function (_, oneMatrixDatum) {
                listCardDom.append(buildCard({
                    data: oneMatrixDatum,
                    settings: settings
                }));
            });
        });
        mediaQueryAndMaxWidth(Context, 770);
    }

    function loadKanban(Context) {
        var settings = Context.data('settings');

        _dragAndDropManager.prependOnly = settings.prependOnly;
        // Traitement des entêtes
        addColumns(Context, settings.headers);

        // Reordonner la matrice
        addData(Context, settings.data);
        buildColumns(Context);
        buildCards(Context);

        bindDragAndDropEvents(Context, _dragAndDropManager);

        // Événements
        Context.off('mouseover').off('mouseout').off('click').off('keydown');
        Context.on('mouseover', '.kanban-list-card-detail', function () {
            $(this).addClass('active-card');
        }).on('mouseout', '.kanban-list-card-detail', function () {
            $(this).removeClass('active-card');
        }).on('click', '.kanban-list-header', function (event) {
            var target = $(event.target);
            var self = $(this);
            var excludeElementsList = ['column-header-text', 'column-header-editor', 'kanban-action-dropdown'];
            function notElement(classnames) {
                return !target.hasClass(classnames) && target.parents(`.${classnames}`).length === 0;
            }

            if (excludeElementsList.every(notElement) && $('.card-composer').length === 0) {
                var wrapperDom = self.parents('.kanban-list-wrapper');
                var column = wrapperDom.data('column');
                wrapperDom.find('.kanban-list-cards').prepend(buildNewCardInput(Context, column)).scrollTop(0);
                wrapperDom.find('.js-card-title').focus();
                wrapperDom.find('.js-add-card').data('context', Context);
            }
        }).on('click', '.kanban-list-card-detail:not(.dragging)', function (event) {
            event.stopPropagation();
            var parentsDomList = ['.contributor-container', '.kanban-footer-card', '.kanban-list-card-action'];
            if (parentsDomList.some(function (oneParentDom) { return $(event.target).parents(oneParentDom).length > 0 })) return false;
            var self = $(this);
            var data = self.data('datum');
            if (typeof settings.onCardClick === 'function') settings.onCardClick(data);
        }).on('click', '.kanban-list-card-detail:not(.dragging) .kanban-list-card-edit', function (event) {
            event.stopPropagation();
            var self = $(this);
            var columnId = self.data('column');
            var columnKanbanDoms = $('.kanban-list-card-edit[data-column="' + columnId + '"]');
            var cardIndex = columnKanbanDoms.index(self);
            var data = self.parents('.kanban-list-card-detail').data('datum');
            if (typeof settings.onEditCardOpen === 'function') settings.onEditCardOpen(data);

            var parentCardDom = self.parents('.kanban-list-card-detail');
            var overlayDom = $('.kanban-overlay');
            var scrollLeft = Context.scrollLeft();
            Context.css('overflow-x', 'hidden');
            Context.scrollLeft(scrollLeft);
            var parentBcr = parentCardDom.get(0).getBoundingClientRect();
            overlayDom.append(buildCardEditor({
                data,
                position: {
                    x: parentBcr.x,
                    y: parentBcr.y
                },
                size: {
                    width: parentCardDom.outerWidth()
                },
                column: columnId,
                index: cardIndex
            })).addClass('active');
            overlayDom.find('.js-add-card').data('context', Context);
            var textAreaDom = overlayDom.find('textarea');
            textAreaDom.focus();
            textAreaDom.select();

            textAreaDom.height(0).height(textAreaDom.prop('scrollHeight')).on('input', function () {
                var self = $(this);
                self.height(0).height(self.prop('scrollHeight'));
            });
        }).on('click', '.kanban-list-card-detail:not(.dragging) .kanban-list-card-switch', function (event) {
            event.stopPropagation();
            var self = $(this);
            var columnId = self.data('column');
            var columnKanbanDoms = $('.kanban-list-card-switch[data-column="' + columnId + '"]');
            var cardIndex = columnKanbanDoms.index(self);
            var matrix = Context.data('matrix');
            var filter = Context.data('filter');
            matrix = filterMatrixBy(matrix, filter);
            var data = matrix[columnId][cardIndex];
            if (typeof settings.onMoveCardOpen === 'function') settings.onMoveCardOpen(data);
            var overlayDom = $('.kanban-overlay');
            var scrollLeft = Context.scrollLeft();
            Context.css('overflow-x', 'hidden');
            Context.scrollLeft(scrollLeft);
            var moveContextDom = buildCardMoveContext(settings.headers, data, matrix)
            overlayDom.append(moveContextDom).addClass('active');
            moveContextDom.on('click', '.js-submit', function () {
                var cardParentDom = self.parents('.kanban-list-card-detail');
                var targetColumn = moveContextDom.find('[name=list-map]').val();
                var targetLine = parseInt(moveContextDom.find('[name=position-map]').val());
                moveCard(Context, cardParentDom, cardParentDom.data('column'), targetColumn, targetLine);
                _dragAndDropManager.onCardDrop(cardParentDom, Context);
                overlayDom.removeClass('active').empty();
            });
        }).on('click', '.kanban-list-card-detail:not(.dragging) .contributors-preview', function () {
            $(this).parents('.kanban-footer-card').next('.contributor-container').slideToggle({ duration: 100 });
        }).on('click', '.kanban-list-card-detail:not(.dragging) .card-action', function () {
            var self = $(this);
            var cardDom = self.parents('.kanban-list-card-detail');
            var data = cardDom.data('datum');
            if (typeof self.data('action') === 'string' && typeof settings[self.data('action')] === 'function') settings[self.data('action')](data, cardDom);
        }).on('click', '.kanban-new-card-button', function () {
            var columnId = $(this).data('column');
            var wrapperDom = $('#kanban-wrapper-' + columnId);
            wrapperDom.find('.kanban-list-cards').append(buildNewCardInput(Context, columnId));
            wrapperDom.find('.js-card-title').focus();
            wrapperDom.find('.js-add-card').data('context', Context);
        }).on('click', '.js-add-card', addCardClicked).on('click', '.kanban-action-dropdown .dropdown-trigger', function () {
            $(this).next('.dropdown-list').toggleClass('open');
        }).on('click', '.kanban-action-dropdown .dropdown-list.open .dropdown-item', function () {
            var self = $(this);
            switch (self.data('target')) {
                case 'add-card':
                    var wrapperDom = self.parents('.kanban-list-wrapper');
                    var column = wrapperDom.data('column');
                    wrapperDom.find('.kanban-list-cards').prepend(buildNewCardInput(Context, column)).scrollTop(0);
                    wrapperDom.find('.js-card-title').focus();
                    wrapperDom.find('.js-add-card').data('context', Context);
                    break;
                case 'column-rename':
                    var wrapperDom = self.parents('.kanban-list-wrapper');
                    var headerEditorDom = wrapperDom.find('.column-header-editor');
                    wrapperDom.find('.column-header-text').hide();
                    headerEditorDom.css('display', 'inline-block');
                    headerEditorDom.focus();
                    headerEditorDom.select();
                    break;
            }
            self.parents('.dropdown-list').removeClass('open');
        }).on('click', '.column-header-text', function () {
            Context.trigger('click');
            var self = $(this);
            var headerEditorDom = self.next('.column-header-editor');
            self.hide();
            headerEditorDom.css('display', 'inline-block');
            headerEditorDom.focus();
            headerEditorDom.select();
        }).on('click', '.contributor-info', function () {
            var self = $(this);
            if (typeof settings.onContributorClick === 'function') settings.onContributorClick(self.data());
        }).on('click', function (event) {
            var activeDropdownDomList = Context.find('.dropdown-list.open');
            var visibleHeaderEditor = Context.find('.column-header-editor').filter(function () {
                return $(this).is(':visible');
            });
            if (activeDropdownDomList.length && $(event.target).parents('.kanban-action-dropdown').length === 0) {
                activeDropdownDomList.removeClass('open');
            }
            var cancelWhenClass = ['column-header-text', 'column-header-editor', 'dropdown-item'];
            if (visibleHeaderEditor.length && cancelWhenClass.every(function (oneClass) { return !$(event.target).hasClass(oneClass) })) {
                var settings = Context.data('settings');
                var labelDom = visibleHeaderEditor.prev('.column-header-text');
                var values = { old: labelDom.text(), new: visibleHeaderEditor.val() };
                visibleHeaderEditor.css('display', '');
                labelDom.text(visibleHeaderEditor.val()).css('display', '');
                if (typeof settings.onHeaderChange === 'function') settings.onHeaderChange({ column: visibleHeaderEditor.parents('.kanban-list-wrapper').data('column'), values });
            }
        }).on('keydown', '.card-composer', function (event) {
            if (event.originalEvent.key === 'Enter') {
                event.preventDefault();
                $(this).find('.js-add-card').trigger('click');
            }
        }).on('keydown', '.column-header-editor', function (event) {
            if (event.originalEvent.key === 'Enter') {
                Context.trigger('click');
            }
        });
        Context.addClass('kanban-initialized');

        var kanbanOverlayDom
        if ($('.kanban-overlay').length === 0) {
            kanbanOverlayDom = $('<div>', { 'class': 'kanban-overlay' });
            $(document.body).prepend(kanbanOverlayDom);
        } else kanbanOverlayDom = $('.kanban-overlay');

        kanbanOverlayDom.on('click', function (event) {
            if (event.target !== this) return;
            var self = $(this);
            if (!self.hasClass('active')) return;
            self.removeClass('active');
            self.empty();
            $('.card-composer').remove();
            $('.kanban-list-card-detail[data-column]:hidden').css('display', '');
            Context.css('overflow-x', '');
        }).on('click', '.js-add-card', addCardClicked).on('keydown', '.card-composer', function (event) {
            if (event.originalEvent.key === 'Enter') {
                event.preventDefault();
                $(this).find('.js-add-card').trigger('click');
            }
        });

        if (typeof settings.onRenderDone === 'function') settings.onRenderDone();
    }

    function initKanban(Context) {
        var settings = Context.data('settings');
        Context.empty().html('');
        Context.append($('<div>', {
            'class': 'kanban-container'
        }));
        if (settings.language === 'en') {
            loadKanban(Context);
        } else {
            loadTranslation(settings.language, settings.endpoint ? settings.endpoint : null).then(function () {
                loadKanban(Context);
            });
        }
    }

    $.fn.kanban = function (options = {}, argument) {
        var Self = this;
        Self.data('matrix', typeof Self.data('matrix') === 'object' ? Self.data('matrix') : {});
        Self.data('settings', typeof Self.data('settings') === 'object' ? Self.data('settings') : {});
        Self.data('filter', typeof Self.data('filter') === 'object' ? Self.data('filter') : {});
        if (typeof options === 'object') {
            var defaultOptions = {
                headers: [],
                data: [],
                headerEditable: true,
                prependOnly: false,
                editable: true,
                actionConditionEnabled: false,
                language: 'en'
            };
            var settings = $.extend(true, {}, defaultOptions, options);
            Self.data('settings', settings);
            Self.data('matrix', {});
            initKanban(Self);
        } else if (typeof options === 'string' && typeof argument !== 'undefined') {
            var settings = Self.data('settings');
            switch (options) {
                case 'setData':
                    var matrixData = $.extend({}, Self.data('matrix'));
                    var data = $.extend({}, argument.data);
                    var index;
                    var column = argument.column ? argument.column : '';
                    if (argument.column) {
                        index = matrixData[argument.column].findIndex(function (datum) {
                            return datum.id === argument.id;
                        });
                    } else {
                        for (column in matrixData) {
                            index = matrixData[column].findIndex(function (datum) {
                                console.log('match', datum.id, argument.id, datum.id === argument.id);
                                return datum.id === argument.id;
                            });
                            if (index >= 0) {
                                break;
                            }
                        }
                    }
                    matrixData[column][index] = data;
                    Self.data('matrix', matrixData);
                    var filter = Self.data('filter');
                    matrixData = filterMatrixBy(matrixData, filter);
                    buildCards(Self, matrixData);
                    bindDragAndDropEvents(Self, _dragAndDropManager);
                    if (typeof settings.onRenderDone === 'function') settings.onRenderDone();
                    break;
                case 'addData':
                    addData(Self, Array.isArray(argument) ? argument : [argument]);
                    var matrix = Self.data('matrix');
                    var filter = Self.data('filter');
                    matrix = filterMatrixBy(matrix, filter);
                    buildCards(Self, matrix);
                    bindDragAndDropEvents(Self, _dragAndDropManager);
                    if (typeof settings.onRenderDone === 'function') settings.onRenderDone();
                case 'deleteData':
                    deleteData(Self, argument);
                    var matrix = Self.data('matrix');
                    var filter = Self.data('filter');
                    matrix = filterMatrixBy(matrix, filter);
                    buildCards(Self, matrix);
                    bindDragAndDropEvents(Self, _dragAndDropManager);
                    if (typeof settings.onRenderDone === 'function') settings.onRenderDone();
                    break;
                case 'getData':
                    var matrixData = $.extend({}, Self.data('matrix'));
                    if (argument.column && argument.index) {
                        return matrixData[argument.column][argument.index];
                    } else {
                        for (var column in matrixData) {
                            var foundData = matrixData[column].find(function (datum) {
                                return datum.id === argument.id;
                            });
                            if (typeof foundData !== 'undefined') return foundData;
                        }
                    }
                    break;
                case 'filter':
                    var filter = argument;
                    var matrix = $.extend({}, Self.data('matrix'));
                    Self.data('filter', filter);
                    matrix = filterMatrixBy(matrix, filter);
                    buildCards(Self, matrix);
                    bindDragAndDropEvents(Self, _dragAndDropManager);
                    if (typeof settings.onRenderDone === 'function') settings.onRenderDone();
                    break;
                case 'moveCard':
                    var cardDom = $('.kanban-list-card-detail[data-id=' + argument.id + ']');
                    var column = cardDom.data('column');
                    moveCard(Self, cardDom, column, argument.target, argument.position);
                    _dragAndDropManager.onCardDrop(cardDom, Self, typeof argument.notify === 'boolean' ? argument.notify : false);
                    break;
            }
        }
        setInterval(function () {
            mediaQueryAndMaxWidth(Self, 770);
        });
        return this;
    }
})(jQuery, window);