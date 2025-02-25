(function ($, W) {
	let KANBAN;
	String.prototype.ucfirst = function () {
		return this.charAt(0).toUpperCase() + this.slice(1);
	};

	var _dragSubstituteDom = $('<div>', {
		'class': 'kanban-list-card-detail substitute'
	});
	var _dictionary = {};
	var _currentLanguage;
	var _dragAndDropManager = {
		prependOnly: false,
		onCardDrop: function (self,  notify) {
			var i;
			if (typeof notify !== 'boolean')
				notify = true;
			var settings = KANBAN.data('settings');
			var oldColumn = self.data('column');
			var newColumn = self.parents('.kanban-list-wrapper').data('column');
			var data = self.data('datum');
			self.attr('data-column', newColumn);
			self.data('column', newColumn);
			self.find('.kanban-list-card-edit').attr('data-column', newColumn).data('column', newColumn);
			self.find('.kanban-list-card-switch').attr('data-column', newColumn).data('column', newColumn);
			var columnKanbanDomList = $('.kanban-list-card-detail[data-column="' + newColumn + '"]');
			var newIndex = columnKanbanDomList.index(self);
			var newDataMatrix = $.extend({}, KANBAN.data('matrix'));
			var dataIndex = newDataMatrix[oldColumn].findIndex(function (datum) {
				return datum.id === data.id;
			});
			data.header = newColumn;
			data.position = newIndex;
			self.data('datum', data);
			newDataMatrix[oldColumn].splice(dataIndex, 1);

			if (newIndex >= newDataMatrix[newColumn].length) {
				newDataMatrix[newColumn].push(data);
			} else {
				newDataMatrix[newColumn].splice(newIndex, 0, data);
			}


			var oldDataList = newDataMatrix[oldColumn];
			for (i = 0; i < oldDataList.length; i++) {
				if (typeof oldDataList[i].position === 'number') {
					oldDataList[i].position = i;
				}
			}
			var newDataList = newDataMatrix[newColumn];
			for (i = 0; i < newDataList.length; i++) {
				if (typeof newDataList[i].position === 'number') {
					newDataList[i].position = i;
				}
			}
			newDataMatrix[oldColumn] = oldDataList;
			newDataMatrix[newColumn] = newDataList;
			var filter = KANBAN.data('filter');
			KANBAN.data('matrix', newDataMatrix);
			newDataMatrix = filterMatrixBy(newDataMatrix, filter);

			KANBAN.find('.card-counter[data-column="' + oldColumn + '"]').text(newDataMatrix[oldColumn].length);
			KANBAN.find('.card-counter[data-column="' + newColumn + '"]').text(newDataMatrix[newColumn].length);
			if (typeof settings.onCardDrop === 'function' && notify) {
				var columnInfo = {
					data: data,
					columns: settings.headers,
					origin: oldColumn,
					target: newColumn
				};
				var dataInfo = {
					origin: oldDataList,
					target: newDataList
				};
				settings.onCardDrop.call(KANBAN, columnInfo, dataInfo);
			}
		},
		onColumnDrop: function (element, notify) {
			if (typeof notify !== 'boolean') {
				notify = true;
			}
			var settings = KANBAN.data('settings');
			var matrix = KANBAN.data('matrix');
			var position = KANBAN.find('.kanban-list-wrapper:not(.js-add-column)').index(element);
			var matrixIndexes = Object.keys(matrix);
			var columnName = element.data('column');
			var oldPosition = matrixIndexes.indexOf(columnName);
			matrixIndexes.splice(oldPosition, 1);
			matrixIndexes.splice(position, 0, columnName);
			var newMatrix = {};
			matrixIndexes.forEach(function (matrixIndex) {
				newMatrix[matrixIndex] = matrix[matrixIndex];
			});
			matrix = $.extend({}, newMatrix);
			KANBAN.data('matrix', matrix);
			if (typeof settings.onColumnDrop === 'function' && notify) {
				settings.onColumnDrop({
					column: columnName,
					columns: matrixIndexes,
					origin: oldPosition,
					target: position
				});
			}
		}
	};

	/**
	 * Formater du texte avec des remplacements
	 * @param {string} string text à l'entré
	 * @param {object} replacement
	 * @returns {string}
	 */
	function printf(string, replacement) {
		if (typeof string !== 'string') {
			return '';
		}
		if (typeof replacement !== 'object') {
			replacement = {};
		}
		return string.replace(/{{(.*?)}}/g, function (match, occurrence) {
			if (typeof replacement[occurrence] !== 'undefined') {
				return replacement[occurrence];
			}
			return match;
		});
	}

	function dataMatrixIndex(datum, matrix) {
		var index = -1;
		if (typeof matrix[datum.header] !== 'undefined') {
			index = matrix[datum.header].findIndex(function (datumFindIndex) {
				return datum.id === datumFindIndex.id;
			});
			if (index >= 0) {
				return index;
			}
		}
		return index;
	}

	function moveCard(Context, cardDom, to, at) {
		var listCardContainerDom = Context.find('.kanban-list-wrapper[data-column="' + to + '"] .kanban-list-cards');
		at = typeof at !== 'number' ? listCardContainerDom.children().length - 1 : at;
		var childrenAtPosition = listCardContainerDom.children().eq(at);
		var cardPosition = listCardContainerDom.children().index(cardDom);
		if (childrenAtPosition.length) {
			if (cardPosition >= 0 && cardPosition < at) {
				childrenAtPosition.after(cardDom);
			} else {
				childrenAtPosition.before(cardDom);
			}
		} else {
			listCardContainerDom.append(cardDom);
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
			var index, filter;
			switch (self.data('action')) {
				case 'update':
					index = parseInt(self.data('target'), 10);
					var cardDetailDom = Context.find('.kanban-list-card-detail[data-column=' + column + ']').eq(index);
					$('[data-column="' + column + '"] .kanban-list-card-title').eq(index).text(textArea.val());
					var oldValue = cardDetailDom.data('datum');
					var newValue = $.extend({}, oldValue);
					newValue.title = textArea.val();
					var realIndex = matrix[column].findIndex(function (data) {
						return data.id === oldValue.id;
					});
					matrix[column][realIndex] = newValue;
					Context.data('matrix', matrix);

					filter = Context.data('filter');
					matrix = filterMatrixBy(matrix, filter);
					if (typeof settings.onCardUpdate === 'function') {
						settings.onCardUpdate({ oldValue: oldValue, newValue: newValue });
					}
					buildCards(Context, matrix);
					bindDragAndDropEvents(Context, _dragAndDropManager);
					if (typeof settings.onRenderDone === 'function') {
						settings.onRenderDone();
					}
					break;
				case 'insert':
					var cardsContainerDom = Context.find('#kanban-wrapper-' + column + ' .kanban-list-cards');
					var createdId = 'Column' + Date.now();
					var newData = {
						id: createdId,
						header: column,
						title: textArea.val(),
						instanceIdentity: createdId,
						position: cardsContainerDom.children().length - 1,
						editable: settings.canEditCard,
						canMoveCard: settings.canMoveCard,
						isClickable: true,
						html: false,
						contributors: [],
						actions: []
					};
					matrix[column].push(newData);
					Context.data('matrix', matrix);

					filter = Context.data('filter');
					var filteredMatrix = filterMatrixBy(matrix, filter);
					index = filteredMatrix[column].findIndex(function (data) {
						return data.id === newData.id;
					});
					if (index >= 0) {
						cardsContainerDom.append(buildCard({
							data: newData,
							settings: settings
						}));
						update_action_count.call(Context, column, filter);
					}
					if (typeof settings.onCardInsert === 'function')
						settings.onCardInsert(newData);
					bindDragAndDropEvents(Context, _dragAndDropManager);
					if (typeof settings.onRenderDone === 'function')
						settings.onRenderDone();
					break;
			}
			$('.js-cancel').trigger('click');
			Context.find('.kanban-list-wrapper').trigger('editor-close');
			$('.kanban-overlay.active').trigger('click');
		}
	}

	function filterMatrixBy(matrix, criterias) {
		var temporaryMatrix = {};
		var originalMatrix = $.extend(true, {}, matrix);
		var column;
		if (typeof criterias.columns !== 'undefined' && Array.isArray(criterias.columns)) {
			for (column in matrix) {
				if (criterias.columns.includes(column)) { temporaryMatrix[column] = matrix[column]; }
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
		if (typeof criterias.attributes === 'object') {
			var attr = criterias.attributes;
			var keyList = Object.keys(attr);
			if (keyList.length) {
				for (column in matrix) {
					temporaryMatrix[column] = matrix[column].filter(function (data) {
						return keyList.filter(function (key) {
							if (typeof data[key] === "undefined")
								return (0);
							if (Array.isArray(data[key]) && Array.isArray(attr[key]))
								return (attr[key].every(every => (data[key].includes(every))));
							else
								return (W.JSON.stringify(data[key]) === W.JSON.stringify(attr[key]));
						}).length > 0;
					});
				}
				matrix = $.extend(true, {}, temporaryMatrix);
				temporaryMatrix = {};
			}
		}

		// restore columns if filtered by columns
		if (typeof criterias.columns !== 'undefined' && Array.isArray(criterias.columns)) {
			for (column in originalMatrix) {
				if (criterias.columns.includes(column)) {
					temporaryMatrix[column] = matrix[column];
				} else {
					temporaryMatrix[column] = originalMatrix[column];
				}
			}
			matrix = $.extend(true, {}, temporaryMatrix);
		}
		return matrix;
	}

	function loadTranslation(language, from) {
		_currentLanguage = language;
		return new W.Promise(function (resolve) {
			$.getJSON((typeof from === 'string' ? from : '') + 'language/' + language + '.json', function (data) {
				_dictionary[language] = data;
				resolve();
			});
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
		if (_dictionary[_currentLanguage] && _dictionary[_currentLanguage][keyword])
			return _dictionary[_currentLanguage][keyword];
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
		var html = printf('' +
			'<div class="card-composer">' +
			'    <div class="list-card js-composer">' +
			'        <div class="list-card-details u-clearfix">' +
			'            <textarea class="list-card-composer-textarea js-card-title" dir="auto" placeholder="{{cardTitle}}…"></textarea>' +
			'        </div>' +
			'    </div>' +
			'    <div class="cc-controls u-clearfix">' +
			'        <div class="cc-controls-section">' +
			'            <input class="nch-button nch-button--primary confirm mod-compact js-add-card" type="submit" value="{{buttonMessage}}" data-column="{{column}}" data-action="insert">' +
			'            <a class="icon-lg icon-close dark-hover js-cancel" href="!#">' +
			'                <span class="fa fa-times"></span>' +
			'            </a>' +
			'        </div>' +
			'    </div>' +
			'</div>', {
			cardTitle: translate('enter a title for this card'),
			buttonMessage: translate('add a card').ucfirst(),
			column: column
		});
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
			if (scrollHeight >= 100) {
				self.css('overflow-y', 'auto');
			} else {
				self.css('overflow', 'hidden');
			}
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

	function buildContributorsDropdown(settings, contributorsList) {
		const card_dom = this;
		const datum = card_dom.data("datum");
		const list_dom = $("<ul>", {
			class: "contributor-list"
		});
		const container_dom = $('<div>')
			.addClass('contributor-container');
		$.each(contributorsList, function (_,contributor) {
			var dataList = typeof contributor.data === 'object' ? contributor.data : {};
				const data = {
					"data-index": _,
				};
				$.each(dataList, function (key, value) {
					data[`data-${key}`] = value;
				});
				function handle_remove_contributor(e) {
					e.stopPropagation();
					const self = $(this);
					const to_delete = $.extend({}, contributor);
					const matrix = KANBAN.data("matrix");

					datum.contributors.splice(self.data("index"), 1);
					card_dom.find(".contributors-preview")
						.html(`${datum.contributors.length} <span class="fa fa-users"></span>`);
					container_dom.remove();
					card_dom.append(buildContributorsDropdown.call(card_dom, settings, datum.contributors));
					matrix[datum.header] = matrix[datum.header].map(vector => {
						if (vector.instanceIdentity !== datum.instanceIdentity)
							return vector;
						return datum;
					});
					KANBAN.data("matrix", matrix);
					if (typeof settings.onContributorRemove === "function")
						settings.onContributorRemove(to_delete);
				}
				const contributor_info =  $("<div>", {
					class: "contributor-info",
					data: {
						card: card_dom,
						settings: settings,
					},
					...data
				})
				.append(`
					<div class="contributor-image">
						<img src="${contributor.image}" alt="${contributor.name}" />
					</div>
				`)
				.append(`<p class="contributor-name">${contributor.name}</p>`)
				.append(
					$("<p>", {
						class: "contributor-remove",
						html: `<i class="fa fa-times"></i>`
					}).on("click", handle_remove_contributor)
				)
				.on("click", function() {
					const self = $(this);

					if (typeof settings.onContributorClick === "function")
						settings.onContributorClick(self.data());
				});
			list_dom.append(contributor_info);
		});
		container_dom.append(list_dom);
		return container_dom;
	}

	function buildCard(options) {
		var data = options.data;
		var settings = options.settings;
		var listCardDetailContainer = $('<div>')
			.attr('data-column', data.header)
			.attr('data-id', data.id)
			.addClass('kanban-list-card-detail')
			.data('datum', data);
		var listCardDetailText = $('<span>', {
			'class': 'kanban-list-card-title'
		});
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
		var cardDuplicate = $('<button>', {
			'class': 'card-duplicate',
			html: '<span class="fa fa-clone"></span>',
			'data-column': data.header
		});
		var cardActionDom = $('<div>', {
			'class': 'kanban-list-card-action'
		});
		var cardFooterDom = $('<div>', {
			'class': 'kanban-footer-card'
		});
		var contributorDom = $('<button>')
			.addClass('contributors-preview')
			.html(data.contributors.length + ' <span class="fa fa-users"></span>');

		if (data.columnReference)
			listCardDetailContainer.addClass('column-referer');
		if (data.html)
			listCardDetailText.html(data.title);
		else 
			listCardDetailText.text(data.title);
		if (settings.canEditCard && data.editable)
			cardActionDom.append(listCardDetailEdit);
		if (settings.canDuplicateCard)
			cardActionDom.append(cardDuplicate);
		if (data.actions.length) {
			$.each(data.actions, function (_, oneAction) {
				var html = '';
				if (typeof oneAction.icon === 'undefined' && typeof oneAction.badge === 'undefined') {
					return true;
				}
				if (settings.actionConditionEnabled && typeof oneAction.hideCondition !== 'undefined') {
					var interrupt = false;
					for (var key in oneAction.hideCondition) {
						if (typeof oneAction[key] !== 'undefined' && oneAction[key].toString() === oneAction.hideCondition[key].toString()) {
							interrupt = true;
						}
					}
					if (interrupt) {
						return true;
					}
				}
				html = ['string', 'number'].includes(typeof oneAction.badge) ? oneAction.badge : '';
				html = html + (typeof oneAction.icon === 'string' ? ((html.length > 0 ? ' ' : '') + ' <span class="' + oneAction.icon + '"></span>') : '');
				var actionDom = $('<button>', {
					'class': 'card-action',
					html: html
				});
				if (typeof oneAction.className !== 'undefined' && oneAction.className.length > 0)
					actionDom
						.addClass('custom')
						.addClass(oneAction.className);
				// Spécificité communecter
				if (oneAction.bstooltip) {
					actionDom
						.attr('title', oneAction.bstooltip.text.replace(/"/g, '&quot;'))
						.attr('data-placement', oneAction.bstooltip.position)
					if (typeof jQuery.fn.tooltip === "function")
						actionDom.tooltip({ container: 'body' });
					if (typeof oneAction.action === 'string')
						actionDom.attr('data-action', oneAction.action);
					if (typeof jQuery.fn.tooltip === "function")
						actionDom.on('click', function () {
							actionDom.tooltip('hide');
						});
				}
				// Spécificité communecter
				cardFooterDom.append(actionDom);
				if (oneAction.action) {
					actionDom.data('action', oneAction.action);
				}
			});
		}
		if (settings.showContributors)
			cardFooterDom.append(contributorDom);
		if (settings.canMoveCard && data.canMoveCard)
			cardActionDom.append(listCardDetailSwitch);
		listCardDetailContainer
			.append(listCardDetailText)
			.append(cardActionDom);
		if (cardFooterDom.children().length)
			listCardDetailContainer.append(cardFooterDom);
		if (data.contributors.length)
			listCardDetailContainer.append(buildContributorsDropdown.call(listCardDetailContainer, settings, data.contributors))
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
		container.html(printf('' +
			'<div class="list-card js-composer">' +
			'   <div class="list-card-details u-clearfix">' +
			'       <textarea class="list-card-composer-textarea js-card-title" dir="auto" placeholder="{{cardTitle}}…">{{cardName}}</textarea>' +
			'   </div>' +
			'</div>' +
			'<div class="cc-controls u-clearfix">' +
			'   <div class="cc-controls-section">' +
			'       <input class="nch-button nch-button--primary confirm mod-compact js-add-card" type="submit" value="{{buttonText}}" data-action="update" data-column="{{column}}" data-target="{{index}}">' +
			'   </div>' +
			'</div>', {
			cardTitle: translate('enter a title for this card'),
			cardName: data.title,
			buttonText: translate('save').ucfirst(),
			column: options.column,
			index: options.index
		}));
		return container;
	}

	function getVerticalDragAfterElement(container, y) {
		var draggableElements = Array.from(container.querySelectorAll('.kanban-list-card-detail:not(.dragging):not(.substitute)'));
		return draggableElements.reduce(function (closest, child) {
			var box = child.getBoundingClientRect();
			var offset = y - box.top - box.height / 2;
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
		}).element;
	}

	function getHorizontalDragAfterElement(container, x) {
		var draggableElements = Array.from(container.querySelectorAll('.kanban-list-wrapper:not(.dragging):not(.js-add-column)'));
		return draggableElements.reduce(function (closest, child) {
			var box = child.getBoundingClientRect();
			var offset = x - box.left - box.width / 2;
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
		}).element;
	}

	function duplicateCard(cardDom, options) {
		var defaultOptions = {
			bindDragAndDropEvent: false
		}
		if (typeof options !== 'object') {
			options = defaultOptions;
		} else {
			options = $.extend(true, {}, defaultOptions, options);
		}
		var context = cardDom.parents('.kanban-initialized');
		var data = getDataFromCard(context, cardDom);
		var copy = $.extend({}, data);
		copy.id = 'Column' + Date.now();
		copy.position = cardDom.parents('.kanban-list-cards').find('.kanban-list-card-detail').index(cardDom) + 1;
		addData(context, [copy]);
		var createdCard = buildCard({ data: copy, settings: context.data('settings') });
		cardDom.after(createdCard);
		if (options.bindDragAndDropEvent) {
			bindDragAndDropEvents(context, _dragAndDropManager);
		}
		return createdCard;
	}

	function update_action_count(column, filter) {
		var matrix, self = this;
		column = typeof column === 'undefined' ? null : column;
		filter = typeof filter === 'object' && filter ? filter : {};
		matrix = filterMatrixBy(this.data('matrix'), filter);
		if (!column)
			$.each(matrix, function (col, vect) {
				self.find('.card-counter[data-column="' + col + '"]').text(vect.length);
			});
		else
			self.find('.card-counter[data-column="' + column + '"]').text(matrix[column].length);
	}

	function bindDragAndDropEvents(Context, events) {
		var settings = Context.data('settings');
		var diffX = 0,
			diffY = 0,
			outerWidth = 0,
			outerHeight = 0,
			width = 0,
			height = 0;
		var dragstart = false, dragover = false;
		var cardCopy = null;
		var isCopyWhenDragFromColumn = false;
		var originalCard = null;


		function externalDropCard(event) {
			var draggingElement = document.querySelector('.kanban-list-card-detail.dragging');
			var targetDom = $(event.target);
			Context.find('.kanban-list-wrapper').attr('draggable', settings.canMoveColumn.toString());
			if (draggingElement !== null && (targetDom.hasClass('kanban-list-card-detail') && !targetDom.get(0).isSameNode(draggingElement) || targetDom.parents('.kanban-list-card-detail').length && !targetDom.parents('.kanban-list-card-detail').get(0).isSameNode(draggingElement))) {
				mouseup(draggingElement);
			}
		}

		function movingCardDrop(event) {
			var draggingElement = document.querySelector('.kanban-list-card-detail.dragging');
			var isFirstMove = dragstart && ($(event.target).hasClass('kanban-list-card-detail') || $(event.target).parents('.kanban-list-card-detail').length > 0) && draggingElement === null;
			var coordinates = {
				x: event.clientX,
				y: event.clientY
			};
			if (isFirstMove || draggingElement !== null) {
				draggingElement = draggingElement !== null ? draggingElement : ($(event.target).hasClass('kanban-list-card-detail') ? event.target : $(event.target).parents('.kanban-list-card-detail').get(0))
				mousemove(coordinates, draggingElement);
			}
			if (!isPointerInsideOf(Context.get(0), coordinates)) {
				mouseup(draggingElement);
			}
		}

		function mousedown(event) {
			if (event.button === 2) {
				return false;
			}
			event.stopPropagation();
			var self = $(this);
			Context.find('.kanban-list-wrapper').attr('draggable', 'false');
			// check selected elelemnt
			var prohibedClasses = ['contributors-preview', 'card-action', 'contributor-container'];
			var filteredTarget = prohibedClasses.filter(function (prohibedClass) {
				return $(event.target).hasClass(prohibedClass) || $(event.target).parents('.' + prohibedClass).length > 0;
			});
			// check selected elelemnt
			originalCard = self;
			var bcr = this.getBoundingClientRect();
			diffX = event.clientX - bcr.x;
			diffY = event.clientY - bcr.y;
			outerWidth = self.outerWidth();
			outerHeight = self.outerHeight();
			width = self.width();
			height = self.height();
			dragstart = settings.canMoveCard && self.data('datum').canMoveCard && filteredTarget.length === 0;
			isCopyWhenDragFromColumn = settings.copyWhenDragFrom.includes(self.data('datum').header);
			originalCard.off('mouseup').one('mouseup', function () {
				mouseup(this);
			});
			if (isCopyWhenDragFromColumn) {
				cardCopy = duplicateCard(self, { bindDragAndDropEvents: false });
				cardCopy.hide();
				cardCopy.off('mouseup').one('mouseup', function () {
					mouseup(this);
				});
			}
			Context.on('mouseup', externalDropCard);
			$(document).on('mousemove', movingCardDrop);
		}

		function mousemove(coordinates, target) {
			if (!dragstart || $(target).length && !$(target).hasClass('kanban-list-card-detail')) {
				return;
			}
			var self = $(target);
			if (cardCopy !== null) {
				cardCopy.show()
				self = cardCopy;
			}
			if (self.hasClass('active-card')) {
				self.removeClass('active-card');
			}
			if (!self.hasClass('dragging')) {
				var bcr = self.get(0).getBoundingClientRect();
				var cardDetailDom = $('.kanban-list-card-detail[data-column="' + self.data('column') + '"]');
				var oldIndex = cardDetailDom.index(self);
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
			}
			if (dragover) {
				self.css({
					left: coordinates.x - diffX,
					top: coordinates.y - diffY
				});
				checkDragOver(coordinates);
			}
		}

		function mouseup(element) {
			var self = $(element);
			Context.find('.kanban-list-wrapper').attr('draggable', settings.canMoveColumn.toString());
			self.off('mouseup');
			Context.off('mouseup', externalDropCard);
			$(document).off('mousemove', movingCardDrop);

			if (!dragstart) {
				if (cardCopy !== null) {
					deleteData(Context, cardCopy.data('datum').id);
					cardCopy.remove();
				}
				initValues();
				return true;
			}
			dragstart = false;
			if (!dragover) {
				if (cardCopy !== null) {
					deleteData(Context, cardCopy.data('datum').id);
					cardCopy.remove();
				}
				initValues();
				return true;
			}
			dragover = false;
			var dragMarker = _dragSubstituteDom.is(':visible') ? _dragSubstituteDom : originalCard;
			var cardColumnReferencer = Context.find('.kanban-list-card-detail.column-referer.hovered');
			cardColumnReferencer.removeClass('hovered');
			var bcr = dragMarker.get(0).getBoundingClientRect();

			if (cardColumnReferencer.length) {
				self.removeClass('dragging').css({ position: '', top: '', left: '', width: '', height: '', transform: '' });
				self.hide(250, function () {
					var referencerData = cardColumnReferencer.data('datum');
					moveCard(Context, self, referencerData.columnReference, cardColumnReferencer.parents('.kanban-list-cards').children().length);
					self.show();
					_dragAndDropManager.onCardDrop(self);
					initValues();
				});
			} else {
				self.animate({
					top: bcr.y,
					left: bcr.x
				}, {
					easing: 'easeOutQuad',
					duration: 250,
					complete: function () {
						self.removeClass('dragging').css({ position: '', top: '', left: '', width: '', height: '', transform: '' });
						dragMarker.after(self);
						_dragSubstituteDom.detach();
						if (dragMarker === _dragSubstituteDom) {
							if (typeof events.onCardDrop === 'function') {
								events.onCardDrop(self, Context);
							}
						} else {
							deleteData(Context, { id: self.data('datum').id });
							self.remove();
						}
						bindDragAndDropEvents(Context, _dragAndDropManager);
						initValues();
					}
				});
			}
		}

		function checkDragOver(position) {
			var settings = settings = Context.data('settings');
			Context.find('.kanban-list-content').each(function () {
				if (!isPointerInsideOf(this, position)) {
					return true;
				}
				var self = $(this);
				self.find('.kanban-list-card-detail.column-referer').removeClass('hovered');
				var hoverefReferenceColumnCard = self.find('.kanban-list-card-detail.column-referer').filter(function () {
					return isPointerInsideOf(this, position);
				});
				var column = self.parents('.kanban-list-wrapper').attr('data-column');
				var cardDomHavingSameInstanceIdentity = self.find('.kanban-list-card-detail:not(.substitute)').filter(function () {
					return originalCard.data('datum').instanceIdentity === $(this).data('datum').instanceIdentity;
				});

				if (hoverefReferenceColumnCard.length) {
					_dragSubstituteDom.detach();
					hoverefReferenceColumnCard.addClass('hovered');
				} else if (!(originalCard.data('datum').header === column && settings.copyWhenDragFrom.includes(column)) && !settings.readonlyHeaders.includes(column) && cardDomHavingSameInstanceIdentity.length === 0) {
					var containerVanillaDom = this.querySelector('.kanban-list-cards');
					var afterElementVanillaDom = getVerticalDragAfterElement(containerVanillaDom, position.y);
					if (typeof afterElementVanillaDom === 'undefined') {
						$(containerVanillaDom).append(_dragSubstituteDom);
					} else {
						$(afterElementVanillaDom).before(_dragSubstituteDom);
					}
				}
			});
		}

		function initValues() {
			cardCopy = null;
			isCopyWhenDragFromColumn = false;
			originalCard = null;
			diffX = 0;
			diffY = 0;
			outerWidth = 0;
			outerHeight = 0;
			width = 0;
			height = 0;
		}

		Context.find('.kanban-list-card-detail').each(function () {
			$(this).off('mousedown').off('mouseup', mouseup);
		});
		Context.find('.kanban-list-card-detail').each(function () {
			$(this).on('mousedown', mousedown);
		});
	}

	function buildCardMoveContext(Context, headers, selectedData, matrixData) {
		var settings = Context.data('settings');

		function shouldCopy(column) {
			return settings.copyWhenDragFrom.includes(column);
		}

		function isColumnReadOnly(column) {
			return settings.readonlyHeaders.includes(column)
		}

		var filteredHeaders = headers.filter(function (filterHeader) {
			return !isColumnReadOnly(filterHeader.id);
		});
		var matrixLengthInHeader = isColumnReadOnly(selectedData.header) ? (filteredHeaders.length ? matrixData[filteredHeaders[0].id].length + 1 : 0) : matrixData[selectedData.header].length;
		var indexOfData = matrixData[selectedData.header].indexOf(selectedData);
		var moveCardContext = $('<div>', {
			'class': 'kanban-move-card'
		});
		moveCardContext.empty().html(printf('' +
			'<h2 class="kanban-card-move-header" {{contextHeader}}</h2>' +
			'<label class="kanban-card-move-label">{{columnLabel}}</label>' +
			'<div class="select">' +
			'    <select class="kanban-target-choice" name="list-map" {{disabledSelect}}>' +
			'        {{columnOptions}}' +
			'    </select>' +
			'</div>' +
			'<label class="kanban-card-move-label">{{positionLabel}}</label>' +
			'<div class="select">' +
			'    <select class="kanban-target-choice" name="position-map" {{disabledPosition}}>' +
			'        {{positionOptions}}' +
			'    </select>' +
			'</div>' +
			'<input class="nch-button nch-button--primary wide js-submit" type="submit" value="{{buttonText}}">', {
			contextHeader: shouldCopy(selectedData.header) ? translate('copy the card').ucfirst() : translate('move the card').ucfirst(),
			columnLabel: translate('list').ucfirst(),
			disabledSelect: filteredHeaders.length === 0 ? 'disabled="disabled"' : '',
			columnOptions: filteredHeaders.map(function (oneHeaderMap) {
				return printf('<option value="{{id}}" {{selectedAttribute}}>{{label}} {{currentIndicator}}</option>', {
					id: oneHeaderMap.id,
					selectedAttribute: oneHeaderMap.id === selectedData.header ? 'selected="selected"' : '',
					label: oneHeaderMap.label,
					currentIndicator: oneHeaderMap.id === selectedData.header ? '(' + translate('current') + ')' : ''
				});
			}).join(''),
			positionLabel: translate('position').ucfirst(),
			disabledPosition: filteredHeaders.length === 0 ? 'disabled="disabled"' : '',
			positionOptions: Array.from({ length: matrixLengthInHeader }, function (_, index) { return index; }).map(function (builtArrayIndex) {
				return printf('<option value="{{index}}" {{selectedAttribute}}>{{indexPlus}} {{currentIndicator}}</option>', {
					index: builtArrayIndex,
					selectedAttribute: builtArrayIndex === indexOfData ? 'selected="selected"' : '',
					indexPlus: builtArrayIndex + 1,
					currentIndicator: builtArrayIndex === indexOfData && !isColumnReadOnly(selectedData.header) ? '(' + translate('current') + ')' : ''
				});
			}).join(''),
			buttonText: shouldCopy(selectedData.header) ? translate('copy').ucfirst() : translate('move').ucfirst()
		}));

		moveCardContext.on('change', '[name=list-map]', function () {
			var newLength = matrixData[this.value].length;
			moveCardContext.find('[name=position-map]').empty().html(Array.from({ length: this.value === selectedData.header ? newLength : newLength + 1 }, function (_, index) {
				return index;
			}).map(function (builtArrayIndex) {
				var that = this;
				return printf('<option value="{{index}}" {{selectedAttribute}}>{{indexPlus}} {{currentIndicator}}</option>', {
					index: builtArrayIndex,
					selectedAttribute: that.value === selectedData.header && builtArrayIndex === indexOfData && !isColumnReadOnly(that.value) ? 'selected="selected"' : '',
					indexPlus: builtArrayIndex + 1,
					currentIndicator: that.value === selectedData.header && builtArrayIndex === indexOfData ? '(' + translate('current') + ')' : ''
				})
			}).join(''));
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

			if (typeof matrix[oneHeader.id] === 'undefined' || !Array.isArray(matrix[oneHeader.id])) {
				matrix[oneHeader.id] = [];
			}
			if (typeof settings.headers.find(findHeader) === 'undefined') {
				settings.headers.push(oneHeader);
			}
			Context.data('matrix', matrix);
			Context.data('settings', settings);
		});
	}

	function addData(Context, data) {
		var settings = Context.data('settings');
		var compiledDataList = data.filter(function (datumFilter) {
			return typeof datumFilter.id !== 'undefined' && typeof datumFilter.header !== 'undefined';
		}).map(function (datumMap) {
			var defaultDadum = {
				html: false,
				instanceIdentity: datumMap.id,
				editable: settings.canEditCard,
				canMoveCard: settings.canMoveCard,
				isClickable: true,
				actions: [],
				contributors: [],
				columnReference: null
			};
			return $.extend(true, {}, defaultDadum, datumMap);
		});
		$.each(compiledDataList, function (_, dataLine) {
			var matrix = $.extend({}, Context.data('matrix'));
			var index;
			if (typeof matrix[dataLine.header] === 'undefined' || !Array.isArray(matrix[dataLine.header]))
				matrix[dataLine.header] = [];
			index = matrix[dataLine.header].findIndex(function (datum) {
				return datum.id === dataLine.id;
			});
			if (index >= 0)
				return (true);
			if (typeof dataLine.position === 'number') {
				if (dataLine.position >= matrix[dataLine.header].length || dataLine.position < 0)
					matrix[dataLine.header].push(dataLine);
				else
					matrix[dataLine.header].splice(dataLine.position, 0, dataLine);
			} else {
				var last = matrix[dataLine.header].pop();
				if (typeof last === 'undefined')
					matrix[dataLine.header].push(dataLine);
				else if (typeof last.position === 'number') {
					if (matrix[dataLine.header].length < last.position)
						matrix[dataLine.header].push(dataLine, last);
					else
						matrix[dataLine.header].push(last, dataLine);
				} else
					matrix[dataLine.header].push(last, dataLine);
			}
			Context.data('matrix', matrix);
		});
	}

	function deleteData(Context, coordinates) {
		var matrix = $.extend({}, Context.data('matrix'));
		var column;
		var id = null, index;
		if (typeof coordinates === 'object' && coordinates) {
			if (typeof coordinates.column !== 'undefined')
				column = coordinates.column;
			if (typeof coordinates.index !== 'undefined')
				index = coordinates.index;
			if (['string', 'number'].includes(typeof coordinates.id))
				id = coordinates.id;
		} else if (['string', 'number'].includes(typeof coordinates))
			id = coordinates
		if (typeof column !== 'undefined' && typeof matrix[column] !== 'undefined') {
			if (typeof index !== 'undefined' && typeof matrix[column][index] !== 'undefined')
				id = matrix[column][index].id;
			else if (id) {
				index = matrix[column].findIndex(function (data) {
					return (data.id === id);
				});
			}
			if (typeof index === 'number' && index >= 0)
				matrix[column].splice(index, 1);
		} else if (id) {
			$.each(matrix, function (col, data) {
				index = data.findIndex(function (line) {
					return (line.id === id);
				});
				if (index >= 0) {
					matrix[col].splice(index, 1);
					return (false);
				}
			});
		}
		Context.data('matrix', matrix);
		return (id);
	}

	function buildColumns(Context) {
		var settings = Context.data('settings');
		var matrix = Context.data('matrix');
		var filter = Context.data('filter');
		var kanbanContainerDom = Context.find('.kanban-container');
		matrix = filterMatrixBy(matrix, filter);
		$.each(matrix, function (oneHeaderKey) {
			if (Context.find('kanban-list-wrapper[data-column="' + oneHeaderKey + '"]').length > 0) {
				return false;
			}
			var oneHeader = settings.headers.find(function (oneHeaderFind) { return oneHeaderFind.id === oneHeaderKey; });
			if (typeof oneHeader === 'undefined')
				return (true);
			oneHeader.menus = typeof oneHeader.menus !== 'object' || !Array.isArray(oneHeader.menus) ? [] : oneHeader.menus;
			kanbanContainerDom.append(buildColumn(Context, oneHeader));
		});
		if (settings.canAddColumn) {
			var kanbanListWrapperDom = $('<div>', {
				'class': 'kanban-list-wrapper js-add-column',
				id: 'kanban-wrapper-null',
				'data-column': null
			});
			var addNewCardButtonDom = $('<button>', {
				'class': 'kanban-new-column',
				html: '<span class="fa fa-plus"></span> ' + translate('add a new column').ucfirst()
			});
			kanbanContainerDom.append(kanbanListWrapperDom.append(addNewCardButtonDom));
		}
	}

	function buildColumn(Context, header, options) {
		var defaultOptions = {
			createMode: false
		};
		if (typeof options !== 'object')
			options = defaultOptions;
		else
			options = $.extend(true, {}, defaultOptions, options);
		var headerDefaultOption = {
			editable: true,
			classNameList: []
		};
		header = $.extend(headerDefaultOption, header);
		var settings = Context.data('settings');
		var kanbanListWrapperDom = $('<div>', {
			'class': 'kanban-list-wrapper',
			id: 'kanban-wrapper-' + header.id,
			'data-column': header.id
		}).attr('draggable', settings.canMoveColumn.toString());
		var kanbanListContentDom = $('<div>', {
			'class': 'kanban-list-content'
		});
		$.each(header.classNameList, function (i, classname) {
			kanbanListContentDom.addClass(classname);
		});
		var kanbanListHeaderDom = $('<div>', {
			'class': 'kanban-list-header',
			html: printf('<span class="column-header-text">{{label}}</span><input class="column-header-editor" value="{{label}}" type="text">{{counterHtml}}', {
				label: header.label,
				counterHtml: settings.showCardNumber ? '<span class="card-counter-container"> (<span data-column="' + header.id + '" class="card-counter">0</span>)</span>' : ''
			})
		}).data('editable', header.editable);

		var dropdownCreateDom = $(printf('' +
			'<ul class="dropdown-list">' +
			'{{editHtml}}' +
			'{{addCardHtml}}' +
			'{{addColumnHtml}}' +
			'</ul>', {
			editHtml: settings.canEditHeader && (settings.defaultColumnMenus.length === 0 || settings.defaultColumnMenus.includes('edit_header')) ? '<li class="dropdown-item" data-target="column-rename">' + translate('rename this column').ucfirst() + '</li>' : '',
			addCardHtml: settings.canAddCard && (settings.defaultColumnMenus.length === 0 || settings.defaultColumnMenus.includes('add_card')) ? '<li class="dropdown-item" data-target="add-card">' + translate('add a new card').ucfirst() + '</li>' : '',
			addColumnHtml: settings.canAddColumn && (settings.defaultColumnMenus.length === 0 || settings.defaultColumnMenus.includes('add_column')) ? '<li class="dropdown-item" data-target="add-column">' + translate('add a new column').ucfirst() + '</li>' : ''
		}));
		$.each(header.menus, function (_, oneMenu) {
			var menuDom = $('<li>').addClass('dropdown-item').attr('data-target', 'custom-menu').data('action', oneMenu.action).data('header', header).text(oneMenu.label);
			dropdownCreateDom.append(menuDom);
		});
		var actionDropdownDom = $('<div>', {
			'class': 'kanban-action-dropdown',
			html: '<button class="dropdown-trigger kanban-themed-button"><span class="fa fa-ellipsis-h"></span></button>'
		});
		if (dropdownCreateDom.children().length) {
			actionDropdownDom.append(dropdownCreateDom)
		}
		var listCardDom = $('<div>', {
			'class': 'kanban-list-cards'
		});
		var composerContainerDom = $('<div>', {
			'class': 'kanban-composer-container'
		});
		var addNewCardButtonDom = $('<button>', {
			'class': 'kanban-new-card-button',
			html: '<span class="fa fa-plus"></span>' + translate('add a new card').ucfirst(),
			data: {
				column: header.id
			}
		});
		kanbanListHeaderDom.append(actionDropdownDom);
		if (settings.canAddCard) {
			composerContainerDom.append(addNewCardButtonDom);
		}
		kanbanListContentDom
			.append(kanbanListHeaderDom)
			.append(listCardDom)
			.append(composerContainerDom);
		if (options.createMode)
			kanbanListHeaderDom.find('.column-header-text').trigger('click');
		return kanbanListWrapperDom.append(kanbanListContentDom);
	}

	function createColumnAfter(wrapperDom, name) {
		var context = wrapperDom.parents('.kanban-initialized');
		var oldMatrix = context.data('matrix');
		var newMatrix = {};
		var newHeader = {
			id: 'Column' + Date.now(),
			label: name ? name : translate('New column'),
			editable: true,
			menus: []
		};
		var newColumn = buildColumn(context, newHeader);
		var settings = context.data('settings');
		var wrapperIndex = context.find('.kanban-list-wrapper').index(wrapperDom);
		settings.headers.splice(wrapperIndex + 1, 0, newHeader);
		$.each(settings.headers, function (_, header) {
			newMatrix[header.id] = typeof oldMatrix[header.id] === 'undefined' ? [] : oldMatrix[header.id];
		});
		context.data('settings', settings);
		context.data('matrix', newMatrix);
		wrapperDom.after(newColumn);
		newColumn.find('.column-header-text').trigger('click');
		if (typeof settings.onColumnInsert === 'function') {
			settings.onColumnInsert.call(context, newHeader);
		}
	}

	function addColumnAfter(wrapperDom, newHeader){
		var context = wrapperDom.parents('.kanban-initialized');
		var oldMatrix = context.data('matrix');
		var newMatrix = {};
		var newColumn = buildColumn(context, newHeader);
		var settings = context.data('settings');
		var wrapperIndex = context.find('.kanban-list-wrapper').index(wrapperDom);
		settings.headers.splice(wrapperIndex + 1, 0, newHeader);
		$.each(settings.headers, function (_, header) {
			newMatrix[header.id] = typeof oldMatrix[header.id] === 'undefined' ? [] : oldMatrix[header.id];
		});
		context.data('settings', settings);
		context.data('matrix', newMatrix);
		wrapperDom.after(newColumn);
		newColumn.find('.column-header-text').trigger('click');
		if (typeof settings.onColumnInsert === 'function') {
			settings.onColumnInsert.call(context, newHeader);
		}
	}

	function buildCards(Context, matrix) {
		var settings = Context.data('settings');
		if (typeof matrix === 'undefined') { matrix = $.extend({}, Context.data('matrix')); }
		$.each(matrix, function (column, oneMatrixData) {
			var listCardDom = Context.find('#kanban-wrapper-' + column + ' .kanban-list-cards');
			Context.find('.kanban-list-header .card-counter[data-column="' + column + '"]').text(oneMatrixData.length);
			listCardDom.empty();
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
		// remove all columns
		Context.find('.kanban-container').empty().html('');
		// build columns
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
			var settings = Context.data('settings');
			var excludeElementsList = ['column-header-text', 'column-header-editor', 'kanban-action-dropdown'];

			function notElement(classNames) {
				return !target.hasClass(classNames) && target.parents('.' + classNames).length === 0;
			}

			if (excludeElementsList.every(notElement) && $('.card-composer').length === 0) {
				var wrapperDom = self.parents('.kanban-list-wrapper');
				var column = wrapperDom.data('column');
				if (typeof settings.onInsertCardAction === 'function')
					settings.onInsertCardAction(column);
				if (!settings.canAddCard)
					return (true);
				wrapperDom.find('.kanban-list-cards').prepend(buildNewCardInput(Context, column)).scrollTop(0);
				wrapperDom.find('.js-card-title').focus();
				wrapperDom.find('.js-add-card').data('context', Context);
			}
		}).on('click', '.kanban-list-card-detail:not(.dragging)', function (event) {
			event.stopPropagation();
			var parentsDomList = ['.contributor-container', '.kanban-footer-card', '.kanban-list-card-action'];
			if (parentsDomList.some(function (oneParentDom) { return $(event.target).parents(oneParentDom).length > 0; })) {
				return false;
			}
			var self = $(this);
			var data = self.data('datum');
			if (typeof settings.onCardClick === 'function' && data.isClickable)
				settings.onCardClick.call(this, data);
		}).on('click', '.kanban-list-card-detail:not(.dragging) .kanban-list-card-edit', function (event) {
			event.stopPropagation();
			var self = $(this);
			var columnId = self.data('column');
			var columnKanbanDoms = Context.find('.kanban-list-wrapper[data-column="' + columnId + '"] .kanban-list-card-detail');
			var parentCardDom = self.parents('.kanban-list-card-detail');
			var cardIndex = columnKanbanDoms.index(parentCardDom);
			var data = getDataFromCard(Context, parentCardDom);
			if (typeof settings.onEditCardAction === 'function') {
				settings.onEditCardAction.call(this, data);
			}

			var overlayDom = $('.kanban-overlay');
			var scrollLeft = Context.scrollLeft();
			Context.css('overflow-x', 'hidden');
			Context.scrollLeft(scrollLeft);
			var parentBcr = parentCardDom.get(0).getBoundingClientRect();
			overlayDom.append(buildCardEditor({
				data: data,
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
			var settings = Context.data('settings');
			var columnId = self.data('column');
			var columnKanbanDoms = $('.kanban-list-card-switch[data-column="' + columnId + '"]');
			var cardIndex = columnKanbanDoms.index(self);
			var matrix = Context.data('matrix');
			var filter = Context.data('filter');
			matrix = filterMatrixBy(matrix, filter);
			var data = matrix[columnId][cardIndex];
			if (typeof settings.onMoveCardAction === 'function') {
				settings.onMoveCardAction(data);
			}
			var overlayDom = $('.kanban-overlay');
			var scrollLeft = Context.scrollLeft();
			Context.css('overflow-x', 'hidden');
			Context.scrollLeft(scrollLeft);
			var moveContextDom = buildCardMoveContext(Context, settings.headers, data, matrix)
			overlayDom.append(moveContextDom).addClass('active');
			moveContextDom.on('click', '.js-submit', function () {
				var cardDom = self.parents('.kanban-list-card-detail');
				var targetColumn = moveContextDom.find('[name=list-map]').val();
				var targetLine = parseInt(moveContextDom.find('[name=position-map]').val());
				if (settings.copyWhenDragFrom.includes(cardDom.data('datum').header)) {
					cardDom = duplicateCard(cardDom)
				}
				moveCard(Context, cardDom, targetColumn, targetLine);
				_dragAndDropManager.onCardDrop(cardDom);
				overlayDom.removeClass('active').empty();
			});
		}).on('click', '.kanban-list-card-detail:not(.dragging) .contributors-preview', function () {
			$(this).parents('.kanban-list-card-detail').find('.contributor-container').slideToggle({ duration: 100 });
		}).on('click', '.kanban-list-card-detail:not(.dragging) .card-action', function () {
			var self = $(this);
			var cardDom = self.parents('.kanban-list-card-detail');
			var data = cardDom.data('datum');
			if (typeof jQuery.fn.tooltip === "function")
				self.tooltip('hide');
			if (typeof self.data('action') === 'string' && typeof settings[self.data('action')] === 'function')
				settings[self.data('action')](data, cardDom);
		}).on('click', '.kanban-list-card-detail:not(.dragging) .card-duplicate', function () {
			var self = $(this);
			duplicateCard(self.parents('.kanban-list-card-detail'));
		}).on('click', '.kanban-new-card-button', function () {
			var columnId = $(this).data('column');
			var wrapperDom = $('#kanban-wrapper-' + columnId);
			wrapperDom.find('.kanban-list-cards').append(buildNewCardInput(Context, columnId));
			wrapperDom.find('.js-card-title').focus();
			wrapperDom.find('.js-add-card').data('context', Context);
			if (typeof settings.onInsertCardAction === 'function') {
				settings.onInsertCardAction(columnId);
			}
		}).on('click', '.js-add-card', addCardClicked).on('click', '.kanban-action-dropdown .dropdown-trigger', function () {
			$(this).next('.dropdown-list').toggleClass('open');
		}).on('click', '.kanban-action-dropdown .dropdown-list.open .dropdown-item', function () {
			var self = $(this);
			var wrapperDom, headerEditorDom;
			switch (self.data('target')) {
				case 'add-card':
					wrapperDom = self.parents('.kanban-list-wrapper');
					var column = wrapperDom.data('column');
					wrapperDom.find('.kanban-list-cards').prepend(buildNewCardInput(Context, column)).scrollTop(0);
					wrapperDom.find('.js-card-title').focus();
					wrapperDom.find('.js-add-card').data('context', Context);
					if (typeof settings.onInsertCardAction === 'function') {
						settings.onInsertCardAction(column);
					}
					break;
				case 'column-rename':
					wrapperDom = self.parents('.kanban-list-wrapper');
					if (typeof settings.onEditHeaderAction === 'function') {
						settings.onEditHeaderAction(wrapperDom.data('column'));
					}
					if (!settings.canEditHeader || !wrapperDom.find('.kanban-list-header').data('editable')) {
						break;
					}
					headerEditorDom = wrapperDom.find('.column-header-editor');
					wrapperDom.find('.column-header-text').hide();
					headerEditorDom.css('display', 'inline-block');
					headerEditorDom.focus();
					headerEditorDom.select();
					break;
				case 'add-column':
					wrapperDom = self.parents('.kanban-list-wrapper');
					headerEditorDom = wrapperDom.find('.column-header-editor');
					createColumnAfter(wrapperDom);
					break;
				case 'custom-menu':
					var header = self.data('header');
					if (typeof self.data('action') === 'string' && typeof settings[self.data('action')] === 'function') {
						settings[self.data('action')](header);
					}
					break;
			}
			self.parents('.dropdown-list').removeClass('open');
		}).on('click', '.kanban-new-column', function (event) {
			event.preventDefault();
			var wrapperDom = $(this).parents('.kanban-list-wrapper').prev('.kanban-list-wrapper');
			createColumnAfter(wrapperDom);
		}).on('click', '.column-header-text', function () {
			Context.trigger('click');
			var self = $(this);
			var wrapperDom = self.parents('.kanban-list-wrapper');
			if (typeof settings.onEditHeaderAction === 'function') {
				settings.onEditHeaderAction(wrapperDom.data('column'));
			}
			if (!settings.canEditHeader || !self.parents('.kanban-list-header').data('editable')) {
				return true;
			}
			var headerEditorDom = self.next('.column-header-editor');
			self.hide();
			headerEditorDom.css('display', 'inline-block');
			headerEditorDom.focus();
			headerEditorDom.select();
		}).on('click', '.contributor-info', function () {
			var self = $(this);
			if (typeof settings.onContributorClick === 'function') {
				settings.onContributorClick(self.data());
			}
		}).on('click', function (event) {
			var activeDropdownDomList = Context.find('.dropdown-list.open');
			var visibleHeaderEditor = Context.find('.column-header-editor').filter(function () {
				return $(this).is(':visible');
			});
			if (activeDropdownDomList.length && $(event.target).parents('.kanban-action-dropdown').length === 0) {
				activeDropdownDomList.removeClass('open');
			}
			var cancelWhenClass = ['column-header-text', 'column-header-editor', 'dropdown-item', 'kanban-new-column'];
			if (visibleHeaderEditor.length && cancelWhenClass.every(function (oneClass) { return !$(event.target).hasClass(oneClass) })) {
				var settings = Context.data('settings');
				var column = visibleHeaderEditor.parents('.kanban-list-wrapper').data('column').toString();
				var headerIndex = settings.headers.findIndex(function (oneHeader) {
					return oneHeader.id === column;
				});
				settings.headers[headerIndex].label = visibleHeaderEditor.val();
				Context.data('settings', settings);
				var labelDom = visibleHeaderEditor.prev('.column-header-text');
				var values = { old: labelDom.text(), new: visibleHeaderEditor.val() };
				visibleHeaderEditor.css('display', '');
				labelDom.text(visibleHeaderEditor.val()).css('display', '');
				if (typeof settings.onHeaderChange === 'function') {
					settings.onHeaderChange({ column: column, values: values });
				}
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
		}).on('mousedown', '.kanban-list-wrapper:not(.js-add-column)', function (event) {
			var bcr = this.getBoundingClientRect();
			diffX = event.clientX - bcr.x;
			diffY = event.clientY - bcr.y;
		}).on('dragstart', '.kanban-list-wrapper:not(.js-add-column)', function (event) {
			var self = $(this);
			event.stopPropagation();
			var bcr = this.getBoundingClientRect();
			outerWidth = self.outerWidth();
			outerHeight = self.find('.kanban-list-content').outerHeight();
			width = self.width();
			height = self.height();
			dragstartColumn = true;

			columnSubstitute.css({
				minWidth: outerWidth - 4,
				width: outerWidth - 4,
				height: outerHeight - 4
			});
			self.before(columnSubstitute);
			self.addClass('dragging')
				.css({
					position: 'fixed',
					top: bcr.y,
					left: bcr.x
				})
				.width(width)
				.height(height)
				.detach();
			Context.append(self);
			event.preventDefault();
		}).on('mousemove', function (event) {
			var draggingElement = document.querySelector('.kanban-list-wrapper.dragging:not(.js-add-column)');
			var coordinates = {
				x: event.clientX,
				y: event.clientY
			};
			if (dragstartColumn && draggingElement !== null) {
				moveColumn(coordinates, draggingElement);
			}
		}).on('mouseup', function () {
			// column drag and drop
			if (dragstartColumn) {
				dragstartColumn = false;
				var draggingElement = $('.kanban-list-wrapper.dragging:not(.js-add-column)');
				var bcr = columnSubstitute.get(0).getBoundingClientRect()
				draggingElement.animate({
					top: bcr.y,
					left: bcr.x
				}, {
					easing: 'easeOutQuad',
					duration: 250,
					complete: function () {
						draggingElement
							.removeClass('dragging')
							.css({
								position: '',
								top: '',
								left: '',
								width: '',
								height: ''
							});
						columnSubstitute
							.after(draggingElement)
							.detach();
						if (typeof _dragAndDropManager.onColumnDrop === 'function')
							_dragAndDropManager.onColumnDrop(draggingElement);
						bindDragAndDropEvents(Context, _dragAndDropManager);
					}
				});
			}
			// column drag and drop
		});
		$(document).on('mousemove', function (event) {
			var coordinates = {
				x: event.clientX,
				y: event.clientY
			};
			if (dragstartColumn && !isPointerInsideOf(Context.get(0), coordinates)) {
				Context.trigger('mouseup');
			}
		})

		// Drag and drop column section
		var diffX = 0,
			diffY = 0,
			outerWidth = 0,
			outerHeight = 0,
			width = 0,
			height = 0,
			dragstartColumn = false,
			columnSubstitute = $('<div>').addClass('kanban-list-wrapper-substitute');

		function moveColumn(coordinates, element) {
			var self = $(element);
			self.css({
				left: coordinates.x - diffX,
				top: coordinates.y - diffY
			});
			checkColumnSubstitutePosition(coordinates);
		}

		function checkColumnSubstitutePosition(position) {
			var containerDom = Context.find('.kanban-container').length ? Context.find('.kanban-container').get(0) : null;
			if (containerDom === null || !isPointerInsideOf(containerDom, position)) {
				return true;
			}
			var afterElementVanillaDom = getHorizontalDragAfterElement(containerDom, position.x);
			if (typeof afterElementVanillaDom === 'undefined') {
				var jsAddColumnWrapperDom = $('.kanban-list-wrapper.js-add-column');
				if (jsAddColumnWrapperDom.length) {
					jsAddColumnWrapperDom.before(columnSubstitute);
				} else {
					$(containerDom).append(columnSubstitute);
				}
			} else {
				$(afterElementVanillaDom).before(columnSubstitute);
			}
		}

		// Drag and drop column section

		Context.addClass('kanban-initialized');

		var kanbanOverlayDom = $('.kanban-overlay');
		if (kanbanOverlayDom.length === 0) {
			kanbanOverlayDom = $('<div>', { 'class': 'kanban-overlay' });
			$(document.body).prepend(kanbanOverlayDom);
		}

		kanbanOverlayDom.on('click', function (event) {
			if (event.target !== this) {
				return;
			}
			var self = $(this);
			if (!self.hasClass('active')) {
				return;
			}
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

		if (typeof settings.onRenderDone === 'function') {
			settings.onRenderDone();
		}
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

	$.fn.kanban = function (options, argument) {
		options = typeof options === 'undefined' ? {} : options;
		KANBAN = this;
		var settings;
		KANBAN.data('matrix', typeof KANBAN.data('matrix') === 'object' ? KANBAN.data('matrix') : {});
		KANBAN.data('settings', typeof KANBAN.data('settings') === 'object' ? KANBAN.data('settings') : {});
		KANBAN.data('filter', typeof KANBAN.data('filter') === 'object' ? KANBAN.data('filter') : {});
		if (typeof options === 'object' && !KANBAN.hasClass('kanban-initialized')) {
			var defaultOptions = {
				headers: [],
				data: [],
				defaultColumnMenus: [],
				canEditHeader: false,
				prependOnly: false,
				canEditCard: true,
				canAddCard: true,
				canDuplicateCard: false,
				canMoveCard: true,
				canMoveColumn: false,
				canAddColumn: false,
				showContributors: false,
				showCardNumber: false,
				actionConditionEnabled: false,
				copyWhenDragFrom: [],
				readonlyHeaders: [],
				language: 'en'
			};
			settings = $.extend(true, {}, defaultOptions, options);
			KANBAN.data('settings', settings);
			KANBAN.data('matrix', {});
			initKanban(KANBAN);
		} else if (typeof options === 'string' && (typeof argument !== 'undefined' || ['destroy'].includes(options))) {
			settings = KANBAN.data('settings');
			var index, filter, matrix, column, data, matrixData, createCardDom;
			switch (options) {
				case 'setData':
					matrixData = $.extend({}, KANBAN.data('matrix'));
					data = $.extend({}, argument.data);
					column = argument.column ? argument.column : '';
					if (argument.column && typeof matrixData[argument.column] !== 'undefined') {
						index = matrixData[argument.column].findIndex(function (datum) {
							return datum.id === argument.id;
						});
					} else {
						for (column in matrixData) {
							index = matrixData[column].findIndex(function (datum) {
								return datum.id === argument.id;
							});
							if (index >= 0) {
								break;
							}
						}
					}
					if (typeof matrixData[column][index] !== 'undefined') {
						matrixData[column][index] = data;
						$.each(data.actions, function (i, action) {
							if (typeof action.bstooltip !== 'undefined' && typeof action.action === 'string') {
								var action_dom = KANBAN.find('.kanban-list-card-detail[data-id="' + action.id + '"] .card-action[data-action="' + action.action + '"]');
								$('.tooltip.in').remove();
								action_dom.attr('data-original-title', action.bstooltip.text.replace(/"/g, '&quot;'));
								if (typeof jQuery.fn.tooltip === "function")
									action_dom.tooltip('_fixTitle')
										.tooltip('show');
							}
						});
						KANBAN.data('matrix', matrixData);
						filter = KANBAN.data('filter');
						matrixData = filterMatrixBy(matrixData, filter);
						var oldCardDom = KANBAN.find('.kanban-list-card-detail[data-id="' + argument.id + '"]');
						if (oldCardDom.length) {
							oldCardDom.after(buildCard({ data: data, settings: settings }));
							oldCardDom.remove();
						}
						bindDragAndDropEvents(Self, _dragAndDropManager);
						if (typeof settings.onRenderDone === 'function')
							settings.onRenderDone();
					}
					break;
				case 'addData':
					var dataToAdd = Array.isArray(argument) ? argument : [argument];
					addData(Self, dataToAdd);
					matrix = KANBAN.data('matrix');
					filter = KANBAN.data('filter');
					matrix = filterMatrixBy(matrix, filter);
					dataToAdd.forEach(function (datumLoop) {
						if (typeof datumLoop.id === 'undefined' || typeof datumLoop.header === 'undefined')
							return;
						var index = dataMatrixIndex(datumLoop, matrix);
						if (index >= 0) {
							KANBAN.find('#kanban-wrapper-' + datumLoop.header + ' .kanban-list-cards').append(buildCard({
								data: matrix[datumLoop.header][index],
								settings: settings
							}));
						}
					});
					update_action_count.call(Self);
					bindDragAndDropEvents(Self, _dragAndDropManager);
					if (typeof settings.onRenderDone === 'function')
						settings.onRenderDone();
					break;
				case 'deleteData':
					var deletedId = deleteData(Self, argument);
					matrix = KANBAN.data('matrix');
					filter = KANBAN.data('filter');
					matrix = filterMatrixBy(matrix, filter);
					if (deletedId !== null) {
						createCardDom = KANBAN.find('.kanban-list-card-detail[data-id=' + deletedId + ']');
						if (typeof jQuery.fn.tooltip === "function")
							createCardDom.find('.card-action').tooltip('destroy');
						createCardDom.remove();
						if (typeof argument === 'object' && argument && argument.column)
							update_action_count.call(Self, argument.column, filter);
						else
							update_action_count.call(Self, null, filter);
						bindDragAndDropEvents(Self, _dragAndDropManager);
						if (typeof settings.onRenderDone === 'function')
							settings.onRenderDone();
					}
					break;
				case 'getData':
					matrixData = $.extend({}, KANBAN.data('matrix'));
					function loc_get_by_id(id, matrix) {
						for (column in matrix) {
							var found = matrix[column].find(function (datum) {
								return (datum.id === id);
							});
							if (typeof found !== 'undefined')
								return (found);
						}
						return ({});
					}
					if (typeof argument === 'string')
						return (loc_get_by_id(argument, matrixData));
					if (typeof argument === 'object') {
						if (typeof argument.column !== 'undefined' && typeof argument.index !== 'undefined')
							return (matrixData[argument.column][argument.index]);
						if (typeof argument.id !== 'undefined')
							return (loc_get_by_id(argument.id, matrixData));
					}
					return ({});
					break;

				case 'addColumn': 
					addColumnAfter(argument.dom, argument.column);
					break;
				case 'filter':
					filter = argument;
					matrix = $.extend({}, KANBAN.data('matrix'));
					KANBAN.data('filter', filter);
					matrix = filterMatrixBy(matrix, filter);
					buildCards(Self, matrix);
					bindDragAndDropEvents(Self, _dragAndDropManager);
					if (typeof settings.onRenderDone === 'function') {
						settings.onRenderDone();
					}
					break;
				case 'moveCard':
					createCardDom = KANBAN.find('.kanban-list-card-detail[data-id="' + argument.id + '"]');
					matrix = KANBAN.data('matrix');
					if (createCardDom.length === 0) {
						for (column in matrix) {
							index = matrix[column].findIndex(function (datum) {
								return datum.id === argument.id;
							});
							if (index >= 0) {
								break;
							}
						}
						data = matrix[column][index];
						argument.position = typeof argument.position === 'number' ? argument.position : matrix[column].length;
						createCardDom = buildCard({ data: data, settings: settings });
						createCardDom.hide();
					} else
						argument.position = typeof argument.position === 'number' ? argument.position : matrix[argument.target].length;
					moveCard(Self, createCardDom, argument.target, argument.position);
					_dragAndDropManager.onCardDrop(createCardDom, typeof argument.notify === 'boolean' ? argument.notify : false);
					break;
				case 'destroy':
					if (typeof settings.onDestroy === 'function')
						settings.onDestroy();
					KANBAN.removeClass('kanban-initialized');
					KANBAN.removeData();
					KANBAN.empty().html('');
					break;
			}
		}
		W.addEventListener('resize', function () {
			mediaQueryAndMaxWidth(Self, 770);
		});
		return this;
	};
})(jQuery, window);
