(function ($, W) {
    String.prototype.ucfirst = function () {
        return this.charAt(0).toUpperCase() + this.slice(1);
    };

    var _dragSubstituteDom = $('<div>', {
        class: 'kanban-list-card-detail substitute',
        width: outerWidth,
        height: outerHeight
    });
    var _dictionnary = {};
    var _currentLanguage;

    function loadTranslation(language) {
        _currentLanguage = language;
        return new Promise(function (resolve) {
            $.getJSON(`language/${language}.json`, function (data) {
                _dictionnary[language] = data;
                resolve();
            })
        });
    }

    function mediaQueryAndMaxWidth(container, width) {
        if(container.outerWidth() <= width) {
            container.find('.kanban-list-wrapper').css({
                'scroll-snap-align': 'center'
            });
            container.find('.kanban-list-card-edit, .kanban-list-card-switch').css({
                'display': 'inline-block'
            });
        } else {
            container.find('.kanban-list-wrapper').css('scroll-snap-align', '');
            container.find('.kanban-list-card-edit, .kanban-list-card-switch').css('display', '');
        }
    }

    function translate(keyword) {
        console.log('dictionnary', _dictionnary, keyword);
        if (_dictionnary[_currentLanguage] && _dictionnary[_currentLanguage][keyword]) return _dictionnary[_currentLanguage][keyword];
        return keyword;
    }

    function isPointerInsideOf(element, position) {
        var bcr = element.getBoundingClientRect();
        var groupX = position.x >= bcr.x && position.x <= bcr.x + bcr.width;
        var groupY = position.y >= bcr.y && position.y <= bcr.y + bcr.height;
        return groupX && groupY;
    }

    function buildCard(options) {
        var listCardDetailContainer = $('<div>', {
            class: 'kanban-list-card-detail',
            'data-column': options.column
        });
        if (typeof options.position === 'number' && options.position >= 0) listCardDetailContainer.attr('data-position', options.position);

        var listCardDetailText = $('<span>', {
            class: 'kanban-list-card-title',
            text: options.text
        });
        var listCardDetailSwitch = $('<button>', {
            class: 'kanban-list-card-switch',
            html: '<span class="fa fa-arrows-h"></span>',
            'data-column': options.column
        });
        var listCardDetailEdit = $('<button>', {
            class: 'kanban-list-card-edit',
            html: '<span class="fa fa-edit"></span>',
            'data-column': options.column
        });
        var cardActionDom = $('<div>', {
            class: 'kanban-list-card-action'
        });
        if (options.editable) cardActionDom.append(listCardDetailEdit);
        cardActionDom.append(listCardDetailSwitch);
        listCardDetailContainer
            .append(listCardDetailText)
            .append(cardActionDom);
        return listCardDetailContainer;
    }

    function buildCardEditor(options) {
        var data = options.data;
        var position = options.position;
        var size = options.size;
        var container = $('<div>', {
            class: 'card-composer',
            css: {
                position: 'absolute',
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

    function bindDragAndDropEvents(context, events) {
        var diffX = 0, diffY = 0, outerWidth = 0, outerHeight = 0, width = 0, height = 0;
        var dragstart = false, dragover = false;

        function mousedown(event) {
            var bcr = this.getBoundingClientRect();
            diffX = event.clientX - bcr.x;
            diffY = event.clientY - bcr.y;
            outerWidth = $(this).outerWidth();
            outerHeight = $(this).outerHeight();
            width = $(this).width();
            height = $(this).height();
            dragstart = true;
            $(this).off('mouseup').one('mouseup', mouseup).on('mousemove', mousemove);
        }
        function mousemove(event) {
            if (!dragstart) return;
            var self = $(this);
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
                context.append(self);
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
            self.off('mousemove');
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
                duration: 150,
                complete() {
                    self.removeClass('dragging').css({ position: '', top: '', left: '', width: '', height: '', transform: '' });
                    _dragSubstituteDom.after(self);
                    _dragSubstituteDom.detach();
                    if (typeof events.onCardDrop === 'function') events.onCardDrop(self, self.data('index'));
                    self.removeData();
                    diffX = 0, diffY = 0, outerWidth = 0, outerHeight = 0, width = 0, height = 0;
                }
            });
        }

        function checkDragOver(position) {
            context.find('.kanban-list-content').each(function () {
                if (isPointerInsideOf(this, position)) {
                    var containerVanillaDom = this.querySelector('.kanban-list-cards');
                    var afterElementVanillaDom = getDragAfterElement(containerVanillaDom, position.y);
                    if (afterElementVanillaDom == null) $(containerVanillaDom).append(_dragSubstituteDom);
                    else if (events.prependOnly) $(this).find('.kanban-list-card-detail:first-child').before(_dragSubstituteDom);
                    else $(afterElementVanillaDom).before(_dragSubstituteDom);
                }
            });
        }

        context.find('.kanban-list-card-detail').each(function () {
            $(this).off('mousedown').off('mousemove', mousemove).off('mouseup', mouseup);
        });
        context.find('.kanban-list-card-detail').each(function () {
            $(this).on('mousedown', mousedown);
        });
    }

    function buildCardMoveContext(headers, selectedData, matrixData) {
        var matrixLengthInHeader = matrixData[selectedData.header].length;
        var indexOfData = matrixData[selectedData.header].indexOf(selectedData);
        var moveCardContext = $('<div>', {
            class: 'kanban-move-card'
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

    function loadKanban(Context, settings, _dataMatrix) {
        var dragAndDropManager = {
            prependOnly: settings.prependOnly,
            onCardDrop(self, oldIndex) {
                var oldColumn = self.data('column');
                var newColumn = self.parents('.kanban-list-wrapper').data('column');
                self.attr('data-column', newColumn);
                self.data('column', newColumn);
                self.find('.kanban-list-card-edit').attr('data-column', newColumn).data('column', newColumn);
                self.find('.kanban-list-card-switch').attr('data-column', newColumn).data('column', newColumn);
                var columnKanbanDoms = $('.kanban-list-card-detail[data-column="' + newColumn + '"]');
                var newIndex = columnKanbanDoms.index(self);
                var newDataMatrix = $.extend({}, _dataMatrix);
                var data = newDataMatrix[oldColumn][oldIndex];
                data.header = newColumn;
                data.position = newIndex;
                newDataMatrix[oldColumn].splice(oldIndex, 1);
                if (newIndex >= newDataMatrix[newColumn].length) newDataMatrix[newColumn].push(data);
                else newDataMatrix[newColumn].splice(newIndex, 0, data);
                _dataMatrix = newDataMatrix;
                self.attr('data-position', newIndex);
                self.data('position', newIndex);
                Context.find(`.card-counter[data-column=${oldColumn}]`).text(newDataMatrix[oldColumn].length);
                Context.find(`.card-counter[data-column=${newColumn}]`).text(newDataMatrix[newColumn].length);
                if (typeof settings.onCardDrop === 'function') settings.onCardDrop({ data, origin: oldColumn, target: newColumn });
            }
        }
        // Traitement des entêtes
        $.each(settings.headers, function (_, oneHeader) {
            var kanbanListWrapperDom = $('<div>', {
                class: 'kanban-list-wrapper',
                id: 'kanban-wrapper-' + oneHeader.id,
                'data-column': oneHeader.id
            });
            var kanbanListContentDom = $('<div>', {
                class: 'kanban-list-content',
            });
            var kanbanListHeaderDom = $('<div>', {
                class: 'kanban-list-header',
                html: `${oneHeader.label} ${settings.showCardNumber ? `(<span data-column="${oneHeader.id}" class="card-counter">${settings.data.filter(oneDataFilter => oneDataFilter.header === oneHeader.id).length}</span>)` : ''}`
            });
            var listCardDom = $('<div>', {
                class: 'kanban-list-cards'
            });
            var composerContainerDom = $('<div>', {
                class: 'kanban-composer-container'
            });
            var addNewCardButtonDom = $('<button>', {
                class: 'kanban-new-card-button',
                html: `<span class="fa fa-plus"></span> ${translate('add a new card').ucfirst()}`,
                data: {
                    column: oneHeader.id
                }
            });
            kanbanListContentDom
                .append(kanbanListHeaderDom)
                .append(listCardDom)
                .append(composerContainerDom.append(addNewCardButtonDom));
            Context.find('.kanban-container').append(kanbanListWrapperDom.append(kanbanListContentDom));
            _dataMatrix[oneHeader.id] = [];
        }.bind(Context));

        // Ajouter les data
        $.each(settings.data, function (_, dataLine) {
            var listCardDom = $('#kanban-wrapper-' + dataLine.header + ' .kanban-list-cards');
            listCardDom.append(buildCard({ column: dataLine.header, text: dataLine.title, editable: settings.editable, position: typeof dataLine.position === 'number' ? dataLine.position : -1 }));
            _dataMatrix[dataLine.header].push(dataLine);
        });

        // Repositionner les éléments s'ils ont de la position
        $.each(settings.data, function (_, dataLine) {
            var listCardDom = $('#kanban-wrapper-' + dataLine.header + ' .kanban-list-cards');
            if (typeof dataLine.position === 'number') {
                var numberOfElements = listCardDom.children().length;
                var cardDom = listCardDom.find(`.kanban-list-card-detail[data-position=${dataLine.position}]`);
                var cardIndex = listCardDom.find('.kanban-list-card-detail').index(cardDom);
                console.log('have position', cardIndex);
                if (dataLine.position >= 0 && dataLine.position < numberOfElements) listCardDom.children().eq(dataLine.position).before(cardDom);
                else listCardDom.append(cardDom);
                _dataMatrix[dataLine.header].splice(dataLine.position, 0, _dataMatrix[dataLine.header].splice(cardIndex, 1)[0]);
            }
        });

        console.log('new data', _dataMatrix);
        bindDragAndDropEvents(Context, dragAndDropManager);

        // Événements
        Context.on('mouseover', '.kanban-list-card-detail', function () {
            $(this).addClass('active-card');
        }).on('mouseout', '.kanban-list-card-detail', function () {
            $(this).removeClass('active-card');
        }).on('click', '.kanban-list-card-detail', function () {
            var self = $(this);
            var columnId = self.data('column');
            var columnKanbanDoms = $('.kanban-list-card-detail[data-column="' + columnId + '"]');
            var cardIndex = columnKanbanDoms.index(this);
            var data = _dataMatrix[columnId][cardIndex];
            if (typeof settings.onCardClick === 'function') settings.onCardClick(data);
        }).on('click', '.kanban-list-card-edit', function (event) {
            event.stopPropagation();
            var self = $(this);
            var columnId = self.data('column');
            var columnKanbanDoms = $('.kanban-list-card-edit[data-column="' + columnId + '"]');
            var cardIndex = columnKanbanDoms.index(self);
            var data = _dataMatrix[columnId][cardIndex];
            if (typeof settings.onEditCardOpen === 'function') settings.onEditCardOpen(data);

            var parentCardDom = self.parents('.kanban-list-card-detail');
            var overlayDom = Context.find('.kanban-overlay');
            var scrollLeft = Context.scrollLeft();
            Context.css('overflow-x', 'hidden');
            Context.scrollLeft(scrollLeft);
            overlayDom.append(buildCardEditor({
                data,
                position: {
                    x: parentCardDom.offset().left,
                    y: parentCardDom.offset().top
                },
                size: {
                    width: parentCardDom.outerWidth()
                },
                column: columnId,
                index: cardIndex
            })).addClass('active');
            var textAreaDom = overlayDom.find('textarea');
            textAreaDom.focus();
            textAreaDom.select();

            textAreaDom.height(0).height(textAreaDom.prop('scrollHeight')).on('input', function () {
                var self = $(this);
                self.height(0).height(self.prop('scrollHeight'));
            });
        }).on('click', '.kanban-list-card-switch', function (event) {
            event.stopPropagation();
            var self = $(this);
            var columnId = self.data('column');
            var columnKanbanDoms = $('.kanban-list-card-switch[data-column="' + columnId + '"]');
            var cardIndex = columnKanbanDoms.index(self);
            var data = _dataMatrix[columnId][cardIndex];
            if (typeof settings.onMoveCardOpen === 'function') settings.onMoveCardOpen(data);
            console.log(cardIndex);
            var overlayDom = Context.find('.kanban-overlay');
            var scrollLeft = Context.scrollLeft();
            Context.css('overflow-x', 'hidden');
            Context.scrollLeft(scrollLeft);
            var moveContextDom = buildCardMoveContext(settings.headers, data, _dataMatrix)
            overlayDom.append(moveContextDom).addClass('active');
            moveContextDom.on('click', '.js-submit', function () {
                var cardParentDom = self.parents('.kanban-list-card-detail');
                var targetColumn = moveContextDom.find('[name=list-map]').val();
                var targetLine = parseInt(moveContextDom.find('[name=position-map]').val());
                var listCardContainerDom = Context.find(`.kanban-list-wrapper[data-column=${targetColumn}] .kanban-list-cards`);
                if (targetLine === 0 && listCardContainerDom.children().eq(targetLine).length === 0 || listCardContainerDom.children().eq(targetLine).length === targetLine) listCardContainerDom.append(cardParentDom);
                else listCardContainerDom.children().eq(targetLine).before(cardParentDom);
                dragAndDropManager.onCardDrop(cardParentDom, cardIndex);
                overlayDom.removeClass('active').empty();
            });
        }).on('click', '.kanban-new-card-button', function () {
            var columnId = $(this).data('column');
            var wrapperDom = $('#kanban-wrapper-' + columnId);
            html = `
            <div class="card-composer">
                <div class="list-card js-composer">
                    <div class="list-card-details u-clearfix">
                        <textarea class="list-card-composer-textarea js-card-title" dir="auto" placeholder="${translate('enter a title for this card')}…"></textarea>
                    </div>
                </div>
                <div class="cc-controls u-clearfix">
                    <div class="cc-controls-section">
                        <input class="nch-button nch-button--primary confirm mod-compact js-add-card" type="submit" value="${translate('add a card').ucfirst()}" data-column="${columnId}" data-action="insert">
                        <a class="icon-lg icon-close dark-hover js-cancel" href="!#">
                            <span class="fa fa-times"></span>
                        </a>
                    </div>
                </div>
            </div>
            `;
            wrapperDom.find('.kanban-list-cards').append(html);
            wrapperDom.find('.js-card-title').focus();
            if (typeof settings.onCreateCardOpen === 'function') settings.onCreateCardOpen(columnId);
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
            $(Context).on('click', checkCloseEditor);
            $('.list-card-composer-textarea').on('input', function () {
                var self = $(this);
                self.height(0);
                var scrollHeight = self.prop('scrollHeight');
                if (scrollHeight >= 100) self.css('overflow-y', 'auto');
                else self.css('overflow', 'hidden');
                scrollHeight = Math.max(Math.min(scrollHeight, 100), 54);
                self.height(scrollHeight);
            });
            wrapperDom.find('.kanban-new-card-button').hide();
            wrapperDom.find('.js-cancel').on('click', function (event) {
                event.preventDefault();
                wrapperDom.trigger('editor-close');
            });
        }).on('click', '.kanban-overlay.active', function (event) {
            if (event.target !== this) return;
            var self = $(this);
            self.removeClass('active');
            self.empty();
            $('.card-composer').remove();
            $('.kanban-list-card-detail[data-column]:hidden').css('display', '');
            Context.css('overflow-x', '');
        }).on('keydown', '.card-composer', function (event) {
            if (event.originalEvent.key === 'Enter') {
                event.preventDefault();
                $(this).find('.js-add-card').trigger('click');
            }
        }).on('click', '.js-add-card', function () {
            var self = $(this);
            var textArea = self.parents('.card-composer').find('.js-card-title');
            if (textArea.val()) {
                var column = self.data('column');
                switch (self.data('action')) {
                    case 'update':
                        var index = parseInt(self.data('target'), 10);
                        $(`[data-column="${column}"] .kanban-list-card-title`).eq(index).text(textArea.val());
                        var oldValue = $.extend({}, _dataMatrix[column][index]);
                        _dataMatrix[column][index].title = textArea.val();
                        var newValue = _dataMatrix[column][index];
                        if (typeof settings.onCardUpdate === 'function') settings.onCardUpdate({ oldValue, newValue });
                        break;
                    case 'insert':
                        $(`#kanban-wrapper-${column} .kanban-list-cards`).append(buildCard({
                            text: textArea.val(),
                            column,
                            editable: settings.editable
                        }));
                        var newData = {
                            header: column,
                            title: textArea.val()
                        };
                        _dataMatrix[column].push(newData);
                        Context.find(`.card-counter[data-column=${column}]`).text(_dataMatrix[column].length);
                        if (typeof settings.onCardInsert === 'function') settings.onCardInsert(newData);
                        bindDragAndDropEvents(Context, dragAndDropManager);
                        break;
                }
                $('.js-cancel').trigger('click');
                $('.kanban-overlay.active').trigger('click');
            }
        });
        Context.addClass('kanban-initialized');
        Context.append('<div class="kanban-overlay"></div>');
        mediaQueryAndMaxWidth(Context, 770);
    }

    $.fn.kanban = function (options = {}) {
        var Self = this;
        Self.append($('<div>', {
            class: 'kanban-container'
        }));
        var _dataMatrix = {};
        var defaultOptions = {
            headers: [],
            data: [],
            headerEditable: true,
            prependOnly: false,
            editable: true,
            language: 'en'
        };
        var settings = $.extend(true, {}, defaultOptions, options);
        if (settings.language === 'en') {
            loadKanban(Self, settings, _dataMatrix);
        } else {
            loadTranslation(settings.language).then(function () {
                loadKanban(Self, settings, _dataMatrix);
            });
        }
        $(W).resize(function() {
            mediaQueryAndMaxWidth(Self, 770);
        })
        return this;
    }
})(jQuery, window);