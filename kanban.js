(function ($, W) {
	String.prototype.ucfirst = function () {
		return this.charAt(0).toUpperCase() + this.slice(1);
	};

	var _dragSubstituteDom = $('<div>', {
		'class': 'kanban-list-card-detail substitute'
	});
	var _dictionary = {};
	var _current_language;
	var _drag_and_drop_manager = {
		prepend_only: false,
		on_card_drop: function (self, kanban_object, notify) {
			var i;
			if (typeof notify !== 'boolean')
				notify = true;
			var settings = kanban_object.data('settings');
			var old_column = self.data('column');
			var new_column = self.parents('.kanban-list-wrapper').data('column');
			var data = self.data('datum');
			self.attr('data-column', new_column);
			self.data('column', new_column);
			self.find('.kanban-list-card-edit').attr('data-column', new_column).data('column', new_column);
			self.find('.kanban-list-card-switch').attr('data-column', new_column).data('column', new_column);
			var kanban_column_dom_list = $('.kanban-list-card-detail[data-column="' + new_column + '"]');
			var new_index = kanban_column_dom_list.index(self);
			var new_matrix_data = $.extend({}, kanban_object.data('matrix'));
			var data_index = new_matrix_data[old_column].findIndex(datum => (datum.id === data.id));
			data.header = new_column;
			data.position = new_index;
			self.data('datum', data);
			new_matrix_data[old_column].splice(data_index, 1);
			if (new_index >= new_matrix_data[new_column].length)
				new_matrix_data[new_column].push(data);
			else
				new_matrix_data[new_column].splice(new_index, 0, data);
			var old_data_list = new_matrix_data[old_column];
			for (i = 0; i < old_data_list.length; i++) {
				if (typeof old_data_list[i].position === 'number')
					old_data_list[i].position = i;
			}
			var new_data_list = new_matrix_data[new_column];
			for (i = 0; i < new_data_list.length; i++) {
				if (typeof new_data_list[i].position === 'number') {
					new_data_list[i].position = i;
				}
			}
			new_matrix_data[old_column] = old_data_list;
			new_matrix_data[new_column] = new_data_list;
			var filter = kanban_object.data('filter');
			kanban_object.data('matrix', new_matrix_data);
			new_matrix_data = filterMatrixBy(new_matrix_data, filter);

			kanban_object.find('.card-counter[data-column="' + old_column + '"]').text(new_matrix_data[old_column].length);
			kanban_object.find('.card-counter[data-column="' + new_column + '"]').text(new_matrix_data[new_column].length);
			if (typeof settings.on_card_drop === 'function' && notify) {
				var column_info = {
					data: data,
					columns: settings.headers,
					origin: old_column,
					target: new_column
				};
				var data_info = {
					origin: old_data_list,
					target: new_data_list
				};
				settings.on_card_drop.call(kanban_object, column_info, data_info);
			}
		},
		on_column_drop: function (element, kanban_object, notify) {
			if (typeof notify !== 'boolean')
				notify = true;
			var settings = kanban_object.data('settings');
			var matrix = kanban_object.data('matrix');
			var position = kanban_object.find('.kanban-list-wrapper:not(.js-add-column)').index(element);
			var matrix_index_list = Object.keys(matrix);
			var column_name = element.data('column');
			var old_position = matrix_index_list.indexOf(column_name);
			matrix_index_list.splice(old_position, 1);
			matrix_index_list.splice(position, 0, column_name);
			var new_matrix = {};
			matrix_index_list.forEach(index => {
				new_matrix[index] = matrix[index];
			});
			matrix = $.extend({}, new_matrix);
			kanban_object.data('matrix', matrix);
			if (typeof settings.on_column_drop === 'function' && notify) {
				settings.on_column_drop.call(kanban_object, {
					column: column_name,
					columns: matrix_index_list,
					origin: old_position,
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
		if (typeof string !== 'string')
			return '';
		if (typeof replacement !== 'object')
			replacement = {};
		return string.replace(/{{(.*?)}}/g, function (match, occurrence) {
			if (typeof replacement[occurrence] !== 'undefined')
				return replacement[occurrence];
			return match;
		});
	}

	function get_data_matrix_index(datum, matrix) {
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

	function do_move_card(kanban_object, card_dom, to, at) {
		var card_container_dom_list = kanban_object.find('.kanban-list-wrapper[data-column="' + to + '"] .kanban-list-cards');
		at = typeof at !== 'number' ? card_container_dom_list.children().length - 1 : at;
		var children_at_position = card_container_dom_list.children().eq(at);
		var cardPosition = card_container_dom_list.children().index(card_dom);
		if (children_at_position.length) {
			if (cardPosition >= 0 && cardPosition < at)
				children_at_position.after(card_dom);
			else
				children_at_position.before(card_dom);
		} else
			card_container_dom_list.append(card_dom);
	}

	function on_add_card_clicked() {
		var self = $(this);
		var kanban_object = self.data('kanban_object');
		var settings = kanban_object.data('settings');
		var textarea_dom = self.parents('.card-composer').find('.js-card-title');
		var matrix = $.extend({}, kanban_object.data('matrix'));
		if (textarea_dom.val()) {
			var column = self.data('column');
			var index, filter;
			switch (self.data('action')) {
				case 'update':
					index = parseInt(self.data('target'), 10);
					var card_detail_dom = kanban_object.find('.kanban-list-card-detail[data-column=' + column + ']').eq(index);
					$('[data-column="' + column + '"] .kanban-list-card-title').eq(index).text(textarea_dom.val());
					var old_value = card_detail_dom.data('datum');
					var new_value = $.extend({}, old_value);
					new_value.title = textarea_dom.val();
					var real_index = matrix[column].findIndex(data => (data.id === old_value.id));
					matrix[column][real_index] = new_value;
					kanban_object.data('matrix', matrix);
					filter = kanban_object.data('filter');
					matrix = filterMatrixBy(matrix, filter);
					if (typeof settings.on_card_update === 'function')
						settings.on_card_update.call(kanban_object, { old_value: old_value, new_value: new_value });
					do_build_cards(kanban_object, matrix);
					bindDragAndDropEvents(kanban_object, _drag_and_drop_manager);
					if (typeof settings.onRenderDone === 'function') {
						settings.onRenderDone();
					}
					break;
				case 'insert':
					var cardsContainerDom = kanban_object.find('#kanban-wrapper-' + column + ' .kanban-list-cards');
					var createdId = 'Column' + Date.now();
					var newData = {
						id: createdId,
						header: column,
						title: textarea_dom.val(),
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
					kanban_object.data('matrix', matrix);

					filter = kanban_object.data('filter');
					var filteredMatrix = filterMatrixBy(matrix, filter);
					index = filteredMatrix[column].findIndex(function (data) {
						return data.id === newData.id;
					});
					if (index >= 0) {
						cardsContainerDom.append(buildCard({
							data: newData,
							settings: settings
						}));
						kanban_object.find('.card-counter[data-column="' + column + '"]').text(filteredMatrix[column].length);
					}

					if (typeof settings.onCardInsert === 'function') {
						settings.onCardInsert(newData);
					}
					bindDragAndDropEvents(kanban_object, _drag_and_drop_manager);
					if (typeof settings.onRenderDone === 'function') {
						settings.onRenderDone();
					}
					break;
			}
			$('.js-cancel').trigger('click');
			kanban_object.find('.kanban-list-wrapper').trigger('editor-close');
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
			var keyList = Object.keys(criterias.attributes);
			if (keyList.length) {
				for (column in matrix) {
					temporaryMatrix[column] = matrix[column].filter(function (data) {
						return keyList.filter(function (filterKey) {
							return typeof data[filterKey] !== 'undefined' && W.JSON.stringify(data[filterKey]) === W.JSON.stringify(criterias.attributes[filterKey]);
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
		_current_language = language;
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
		if (_dictionary[_current_language] && _dictionary[_current_language][keyword]) {
			return _dictionary[_current_language][keyword];
		}
		return keyword;
	}

	function isPointerInsideOf(element, position) {
		var bcr = element.getBoundingClientRect();
		var groupX = position.x >= bcr.x && position.x <= bcr.x + bcr.width;
		var groupY = position.y >= bcr.y && position.y <= bcr.y + bcr.height;
		return groupX && groupY;
	}

	function buildNewCardInput(kanban_object, column) {
		var wrapperDom = kanban_object.find('#kanban-wrapper-' + column);
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
			kanban_object.off('click', checkCloseEditor);
		});

		function checkCloseEditor(event) {
			var cardComposerDom = wrapperDom.find('.card-composer');
			var targetDom = $(event.target);
			if (!targetDom.get(0).isSameNode(cardComposerDom.get(0)) && targetDom.parents('.card-composer').length === 0) {
				wrapperDom.trigger('editor-close');
			}
		}

		kanban_object.on('click', checkCloseEditor);
		kanban_object.find('.list-card-composer-textarea').on('input', function () {
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

	function getDataFromCard(kanban_object, card_dom) {
		var filter = kanban_object.data('filter');
		var column = card_dom.data('column');
		var index = card_dom.parents('.kanban-list-cards').find('.kanban-list-card-detail').index(card_dom);
		var matrix = kanban_object.data('matrix');
		var filteredMatrix = filterMatrixBy(matrix, filter);
		return filteredMatrix[column][index];
	}

	function buildContributorsDropdown(contributorsList) {
		var html = printf('<ul class="contributor-list">{{contributorList}}</ul>', {
			contributorList: contributorsList.map(function (oneContributor) {
				var dataList = typeof oneContributor.data === 'object' ? oneContributor.data : {};
				var dataString = '';
				$.each(dataList, function (key, value) {
					dataString += printf('data-{{replacedKey}}="{{value}}" ', {
						replacedKey: key.replace(/A-Z/g, function (match) {
							return '-' + match.toLowerCase();
						}),
						value: value.toString().replace(/"/g, '&quot;')
					});
				});
				if (dataString.length > 0) {
					dataString = dataString.substring(0, dataString.length - 1);
				}
				return printf('' +
					'<li class="contributor-info" {{dataString}}>' +
					'   <div class="contributor-image">' +
					'       <img src="{{image}}" alt="{{name}}" />' +
					'   </div>' +
					'   <p class="contributor-name">{{name}}</p>' +
					'</li>', {
					dataString: dataString,
					image: oneContributor.image,
					name: oneContributor.name
				});
			}).join('')
		});
		return $('<div>')
			.addClass('contributor-container')
			.html(html);
	}

	function buildCard(options) {
		var data = options.data;
		var settings = options.settings;
		var listCardDetailContainer = $('<div>')
			.attr('data-column', data.header)
			.attr('data-id', data.id)
			.addClass('kanban-list-card-detail')
			.data('datum', data);

		if (data.columnReference) {
			listCardDetailContainer.addClass('column-referer');
		}

		var listCardDetailText = $('<span>', {
			'class': 'kanban-list-card-title'
		});

		if (data.html) { listCardDetailText.html(data.title); } else { listCardDetailText.text(data.title); }

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
		if (settings.canEditCard && data.editable) { cardActionDom.append(listCardDetailEdit); }
		if (settings.canDuplicateCard) {
			cardActionDom.append(cardDuplicate);
		}
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
				if (typeof oneAction.className !== 'undefined' && oneAction.className.length > 0) {
					actionDom.addClass('custom').addClass(oneAction.className);
				}
				// Spécificité communecter
				if (oneAction.bstooltip) {
					actionDom
						.tooltip({
							title: oneAction.bstooltip.text.replace(/"/g, '&quot;'),
							container: 'body',
							placement: oneAction.bstooltip.position
						});
					if (typeof oneAction.action === 'string')
						actionDom.attr('data-action', oneAction.action);
				}
				// Spécificité communecter
				cardFooterDom.append(actionDom);
				if (oneAction.action) {
					actionDom.data('action', oneAction.action);
				}
			});
		}
		if (settings.showContributors) {
			cardFooterDom.append(contributorDom);
		}
		if (settings.canMoveCard && data.canMoveCard) {
			cardActionDom.append(listCardDetailSwitch);
		}
		listCardDetailContainer
			.append(listCardDetailText)
			.append(cardActionDom);
		if (cardFooterDom.children().length) {
			listCardDetailContainer.append(cardFooterDom);
		}
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

	function duplicateCard(card_dom, options) {
		var defaultOptions = {
			bindDragAndDropEvent: false
		}
		if (typeof options !== 'object') {
			options = defaultOptions;
		} else {
			options = $.extend(true, {}, defaultOptions, options);
		}
		var kanban_object = card_dom.parents('.kanban-initialized');
		var data = getDataFromCard(kanban_object, card_dom);
		var copy = $.extend({}, data);
		copy.id = 'Column' + Date.now();
		copy.position = card_dom.parents('.kanban-list-cards').find('.kanban-list-card-detail').index(card_dom) + 1;
		addData(kanban_object, [copy]);
		var createdCard = buildCard({ data: copy, settings: kanban_object.data('settings') });
		card_dom.after(createdCard);
		if (options.bindDragAndDropEvent) {
			bindDragAndDropEvents(kanban_object, _drag_and_drop_manager);
		}
		return createdCard;
	}

	function bindDragAndDropEvents(kanban_object, events) {
		var settings = kanban_object.data('settings');
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
			kanban_object.find('.kanban-list-wrapper').attr('draggable', settings.canMoveColumn.toString());
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
			if (!isPointerInsideOf(kanban_object.get(0), coordinates)) {
				mouseup(draggingElement);
			}
		}

		function mousedown(event) {
			if (event.button === 2) {
				return false;
			}
			event.stopPropagation();
			var self = $(this);
			kanban_object.find('.kanban-list-wrapper').attr('draggable', 'false');
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
			kanban_object.on('mouseup', externalDropCard);
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
				var card_detail_dom = $('.kanban-list-card-detail[data-column="' + self.data('column') + '"]');
				var oldIndex = card_detail_dom.index(self);
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
				kanban_object.append(self);
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
			kanban_object.find('.kanban-list-wrapper').attr('draggable', settings.canMoveColumn.toString());
			self.off('mouseup');
			kanban_object.off('mouseup', externalDropCard);
			$(document).off('mousemove', movingCardDrop);

			if (!dragstart) {
				if (cardCopy !== null) {
					deleteData(kanban_object, cardCopy.data('datum').id);
					cardCopy.remove();
				}
				initValues();
				return true;
			}
			dragstart = false;
			if (!dragover) {
				if (cardCopy !== null) {
					deleteData(kanban_object, cardCopy.data('datum').id);
					cardCopy.remove();
				}
				initValues();
				return true;
			}
			dragover = false;
			var dragMarker = _dragSubstituteDom.is(':visible') ? _dragSubstituteDom : originalCard;
			var cardColumnReferencer = kanban_object.find('.kanban-list-card-detail.column-referer.hovered');
			cardColumnReferencer.removeClass('hovered');
			var bcr = dragMarker.get(0).getBoundingClientRect();

			if (cardColumnReferencer.length) {
				self.removeClass('dragging').css({ position: '', top: '', left: '', width: '', height: '', transform: '' });
				self.hide(250, function () {
					var referencerData = cardColumnReferencer.data('datum');
					console.log('Moving', self, referencerData.columnReference)
					do_move_card(kanban_object, self, referencerData.columnReference, cardColumnReferencer.parents('.kanban-list-cards').children().length);
					self.show();
					_drag_and_drop_manager.on_card_drop(self, kanban_object);
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
							if (typeof events.on_card_drop === 'function') {
								events.on_card_drop(self, kanban_object);
							}
						} else {
							deleteData(kanban_object, { id: self.data('datum').id });
							self.remove();
						}
						bindDragAndDropEvents(kanban_object, _drag_and_drop_manager);
						initValues();
					}
				});
			}
		}

		function checkDragOver(position) {
			var settings = kanban_object.data('settings');
			kanban_object.find('.kanban-list-content').each(function () {
				if (!isPointerInsideOf(this, position)) {
					return true;
				}
				var self = $(this);
				self.find('.kanban-list-card-detail.column-referer').removeClass('hovered');
				var hoverefReferenceColumnCard = self.find('.kanban-list-card-detail.column-referer').filter(function () {
					return isPointerInsideOf(this, position);
				});
				var column = self.parents('.kanban-list-wrapper').attr('data-column');
				var card_domHavingSameInstanceIdentity = self.find('.kanban-list-card-detail:not(.substitute)').filter(function () {
					return originalCard.data('datum').instanceIdentity === $(this).data('datum').instanceIdentity;
				});

				if (hoverefReferenceColumnCard.length) {
					_dragSubstituteDom.detach();
					hoverefReferenceColumnCard.addClass('hovered');
				} else if (!(originalCard.data('datum').header === column && settings.copyWhenDragFrom.includes(column)) && !settings.readonlyHeaders.includes(column) && card_domHavingSameInstanceIdentity.length === 0) {
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

		kanban_object.find('.kanban-list-card-detail').each(function () {
			$(this).off('mousedown').off('mouseup', mouseup);
		});
		kanban_object.find('.kanban-list-card-detail').each(function () {
			$(this).on('mousedown', mousedown);
		});
	}

	function buildCardMovekanban_object(kanban_object, headers, selectedData, matrixData) {
		var settings = kanban_object.data('settings');

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
		var moveCardkanban_object = $('<div>', {
			'class': 'kanban-move-card'
		});
		moveCardkanban_object.empty().html(printf('' +
			'<h2 class="kanban-card-move-header" {{kanban_objectHeader}}</h2>' +
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
			kanban_objectHeader: shouldCopy(selectedData.header) ? translate('copy the card').ucfirst() : translate('move the card').ucfirst(),
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

		moveCardkanban_object.on('change', '[name=list-map]', function () {
			var newLength = matrixData[this.value].length;
			moveCardkanban_object.find('[name=position-map]').empty().html(Array.from({ length: this.value === selectedData.header ? newLength : newLength + 1 }, function (_, index) {
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
		return moveCardkanban_object;
	}

	function addColumns(kanban_object, headers) {
		$.each(headers, function (_, oneHeader) {
			var matrix = $.extend({}, kanban_object.data('matrix'));
			var settings = kanban_object.data('settings');

			function findHeader(oneHeaderFind) {
				return oneHeaderFind.id === oneHeader.id;
			}

			if (typeof matrix[oneHeader.id] === 'undefined' || !Array.isArray(matrix[oneHeader.id])) {
				matrix[oneHeader.id] = [];
			}
			if (typeof settings.headers.find(findHeader) === 'undefined') {
				settings.headers.push(oneHeader);
			}
			kanban_object.data('matrix', matrix);
			kanban_object.data('settings', settings);
		});
	}

	function addData(kanban_object, data) {
		var settings = kanban_object.data('settings');
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
			var matrix = $.extend({}, kanban_object.data('matrix'));
			if (typeof matrix[dataLine.header] === 'undefined' || !Array.isArray(matrix[dataLine.header])) {
				matrix[dataLine.header] = [];
			}
			if (matrix[dataLine.header].findIndex(function (datum) {
				return datum.id === dataLine.id;
			}) >= 0) {
				return true;
			}
			if (typeof dataLine.position === 'number') {
				if (dataLine.position >= matrix[dataLine.header].length || dataLine.position < 0) {
					matrix[dataLine.header].push(dataLine);
				} else {
					matrix[dataLine.header].splice(dataLine.position, 0, dataLine);
				}
			} else {
				var last = matrix[dataLine.header].pop();
				if (typeof last === 'undefined') {
					matrix[dataLine.header].push(dataLine);
				} else if (typeof last.position === 'number') {
					if (matrix[dataLine.header].length < last.position) {
						matrix[dataLine.header].push(dataLine, last);
					} else {
						matrix[dataLine.header].push(last, dataLine);
					}
				} else {
					matrix[dataLine.header].push(last, dataLine);
				}
			}
			kanban_object.data('matrix', matrix);
		});
	}

	function deleteData(kanban_object, coordinates) {
		var matrix = $.extend({}, kanban_object.data('matrix'));
		var id = null, index;
		if (typeof coordinates === 'object' && typeof coordinates.index !== 'undefined' && typeof matrix[coordinates.column] !== 'undefined' && typeof matrix[coordinates.column][coordinates.index] !== 'undefined') {
			id = matrix[coordinates.column][coordinates.index].id;
			matrix[coordinates.column].splice(coordinates.index, 1);
		} else if (typeof coordinates === 'object' && typeof coordinates.id !== 'undefined' && typeof coordinates.column !== 'undefined') {
			index = matrix[coordinates.column].findIndex(function (data) {
				return data.id === coordinates.id;
			});
			if (typeof matrix[coordinates.column] !== 'undefined' && typeof matrix[coordinates.column][index] !== 'undefined') {
				id = matrix[coordinates.column][index].id;
				matrix[coordinates.column].splice(index, 1);
			}
		} else {
			coordinates = typeof coordinates === 'object' && coordinates.id ? coordinates.id : coordinates;
			for (var column in matrix) {
				index = matrix[column].findIndex(function (data) {
					return data.id === coordinates;
				});
				if (index >= 0) {
					id = matrix[column][index].id;
					matrix[column].splice(index, 1);
					break;
				}
			}
		}
		kanban_object.data('matrix', matrix);
		return id;
	}

	function buildColumns(kanban_object) {
		var settings = kanban_object.data('settings');
		var matrix = kanban_object.data('matrix');
		var filter = kanban_object.data('filter');
		var kanbanContainerDom = kanban_object.find('.kanban-container');
		matrix = filterMatrixBy(matrix, filter);
		$.each(matrix, function (oneHeaderKey) {
			if (kanban_object.find('kanban-list-wrapper[data-column="' + oneHeaderKey + '"]').length > 0) {
				return false;
			}
			var oneHeader = settings.headers.find(function (oneHeaderFind) { return oneHeaderFind.id === oneHeaderKey; });
			if (typeof oneHeader === 'undefined') {
				return true;
			}
			oneHeader.menus = typeof oneHeader.menus !== 'object' || !Array.isArray(oneHeader.menus) ? [] : oneHeader.menus;
			kanbanContainerDom.append(buildColumn(kanban_object, oneHeader));
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

	function buildColumn(kanban_object, header, options) {
		var defaultOptions = {
			createMode: false
		}
		if (typeof options !== 'object') {
			options = defaultOptions;
		} else {
			options = $.extend(true, {}, defaultOptions, options);
		}

		var headerDefaultOption = { editable: true };
		header = $.extend(headerDefaultOption, header);
		var settings = kanban_object.data('settings');
		var kanbanListWrapperDom = $('<div>', {
			'class': 'kanban-list-wrapper',
			id: 'kanban-wrapper-' + header.id,
			'data-column': header.id
		}).attr('draggable', settings.canMoveColumn.toString());
		var kanbanListContentDom = $('<div>', {
			'class': 'kanban-list-content'
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
		var listcard_dom = $('<div>', {
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
			.append(listcard_dom)
			.append(composerContainerDom);
		if (options.createMode)
			kanbanListHeaderDom.find('.column-header-text').trigger('click');
		return kanbanListWrapperDom.append(kanbanListContentDom);
	}

	function createColumnAfter(wrapperDom) {
		var kanban_object = wrapperDom.parents('.kanban-initialized');
		var oldMatrix = kanban_object.data('matrix');
		var new_matrix = {};
		var newHeader = {
			id: 'Column' + Date.now(),
			label: translate('New column'),
			editable: true,
			menus: []
		};
		var new_column = buildColumn(kanban_object, newHeader);
		var settings = kanban_object.data('settings');
		var wrapperIndex = kanban_object.find('.kanban-list-wrapper').index(wrapperDom);
		settings.headers.splice(wrapperIndex + 1, 0, newHeader);
		$.each(settings.headers, function (_, header) {
			new_matrix[header.id] = typeof oldMatrix[header.id] === 'undefined' ? [] : oldMatrix[header.id];
		});
		kanban_object.data('settings', settings);
		kanban_object.data('matrix', new_matrix);
		wrapperDom.after(new_column);
		new_column.find('.column-header-text').trigger('click');
		if (typeof settings.onColumnInsert === 'function') {
			settings.onColumnInsert.call(kanban_object, newHeader);
		}
	}

	function do_build_cards(kanban_object, matrix) {
		var settings = kanban_object.data('settings');
		if (typeof matrix === 'undefined') { matrix = $.extend({}, kanban_object.data('matrix')); }
		$.each(matrix, function (column, oneMatrixData) {
			var listcard_dom = kanban_object.find('#kanban-wrapper-' + column + ' .kanban-list-cards');
			kanban_object.find('.kanban-list-header .card-counter[data-column="' + column + '"]').text(oneMatrixData.length);
			listcard_dom.empty();
			$.each(oneMatrixData, function (_, oneMatrixDatum) {
				listcard_dom.append(buildCard({
					data: oneMatrixDatum,
					settings: settings
				}));
			});
		});
		mediaQueryAndMaxWidth(kanban_object, 770);
	}

	function loadKanban(kanban_object) {
		var settings = kanban_object.data('settings');

		_drag_and_drop_manager.prepend_only = settings.prepend_only;
		// Traitement des entêtes
		addColumns(kanban_object, settings.headers);

		// Reordonner la matrice
		addData(kanban_object, settings.data);
		// remove all columns
		kanban_object.find('.kanban-container').empty().html('');
		// build columns
		buildColumns(kanban_object);
		do_build_cards(kanban_object);

		bindDragAndDropEvents(kanban_object, _drag_and_drop_manager);

		// Événements
		kanban_object.off('mouseover').off('mouseout').off('click').off('keydown');
		kanban_object.on('mouseover', '.kanban-list-card-detail', function () {
			$(this).addClass('active-card');
		}).on('mouseout', '.kanban-list-card-detail', function () {
			$(this).removeClass('active-card');
		}).on('click', '.kanban-list-header', function (event) {
			var target = $(event.target);
			var self = $(this);
			var settings = kanban_object.data('settings');
			var excludeElementsList = ['column-header-text', 'column-header-editor', 'kanban-action-dropdown'];

			function notElement(classNames) {
				return !target.hasClass(classNames) && target.parents('.' + classNames).length === 0;
			}

			if (excludeElementsList.every(notElement) && $('.card-composer').length === 0) {
				var wrapperDom = self.parents('.kanban-list-wrapper');
				var column = wrapperDom.data('column');
				if (typeof settings.onInsertCardAction === 'function') {
					settings.onInsertCardAction(column);
				}
				if (!settings.canAddCard) {
					return true;
				}
				wrapperDom.find('.kanban-list-cards').prepend(buildNewCardInput(kanban_object, column)).scrollTop(0);
				wrapperDom.find('.js-card-title').focus();
				wrapperDom.find('.js-add-card').data('kanban_object', kanban_object);
			}
		}).on('click', '.kanban-list-card-detail:not(.dragging)', function (event) {
			event.stopPropagation();
			var parentsDomList = ['.contributor-container', '.kanban-footer-card', '.kanban-list-card-action'];
			if (parentsDomList.some(function (oneParentDom) { return $(event.target).parents(oneParentDom).length > 0; })) {
				return false;
			}
			var self = $(this);
			var data = self.data('datum');
			if (typeof settings.onCardClick === 'function' && data.isClickable) {
				settings.onCardClick.call(this, data);
			}
		}).on('click', '.kanban-list-card-detail:not(.dragging) .kanban-list-card-edit', function (event) {
			event.stopPropagation();
			var self = $(this);
			var columnId = self.data('column');
			var columnKanbanDoms = kanban_object.find('.kanban-list-wrapper[data-column="' + columnId + '"] .kanban-list-card-detail');
			var parentcard_dom = self.parents('.kanban-list-card-detail');
			var cardIndex = columnKanbanDoms.index(parentcard_dom);
			var data = getDataFromCard(kanban_object, parentcard_dom);
			if (typeof settings.onEditCardAction === 'function') {
				settings.onEditCardAction.call(this, data);
			}

			var overlayDom = $('.kanban-overlay');
			var scrollLeft = kanban_object.scrollLeft();
			kanban_object.css('overflow-x', 'hidden');
			kanban_object.scrollLeft(scrollLeft);
			var parentBcr = parentcard_dom.get(0).getBoundingClientRect();
			overlayDom.append(buildCardEditor({
				data: data,
				position: {
					x: parentBcr.x,
					y: parentBcr.y
				},
				size: {
					width: parentcard_dom.outerWidth()
				},
				column: columnId,
				index: cardIndex
			})).addClass('active');
			overlayDom.find('.js-add-card').data('kanban_object', kanban_object);
			var textarea_dom = overlayDom.find('textarea');
			textarea_dom.focus();
			textarea_dom.select();

			textarea_dom.height(0).height(textarea_dom.prop('scrollHeight')).on('input', function () {
				var self = $(this);
				self.height(0).height(self.prop('scrollHeight'));
			});
		}).on('click', '.kanban-list-card-detail:not(.dragging) .kanban-list-card-switch', function (event) {
			event.stopPropagation();
			var self = $(this);
			var settings = kanban_object.data('settings');
			var columnId = self.data('column');
			var columnKanbanDoms = $('.kanban-list-card-switch[data-column="' + columnId + '"]');
			var cardIndex = columnKanbanDoms.index(self);
			var matrix = kanban_object.data('matrix');
			var filter = kanban_object.data('filter');
			matrix = filterMatrixBy(matrix, filter);
			var data = matrix[columnId][cardIndex];
			if (typeof settings.onMoveCardAction === 'function') {
				settings.onMoveCardAction(data);
			}
			var overlayDom = $('.kanban-overlay');
			var scrollLeft = kanban_object.scrollLeft();
			kanban_object.css('overflow-x', 'hidden');
			kanban_object.scrollLeft(scrollLeft);
			var movekanban_objectDom = buildCardMovekanban_object(kanban_object, settings.headers, data, matrix)
			overlayDom.append(movekanban_objectDom).addClass('active');
			movekanban_objectDom.on('click', '.js-submit', function () {
				var card_dom = self.parents('.kanban-list-card-detail');
				var targetColumn = movekanban_objectDom.find('[name=list-map]').val();
				var targetLine = parseInt(movekanban_objectDom.find('[name=position-map]').val());
				if (settings.copyWhenDragFrom.includes(card_dom.data('datum').header)) {
					card_dom = duplicateCard(card_dom)
				}
				do_move_card(kanban_object, card_dom, targetColumn, targetLine);
				_drag_and_drop_manager.on_card_drop(card_dom, kanban_object);
				overlayDom.removeClass('active').empty();
			});
		}).on('click', '.kanban-list-card-detail:not(.dragging) .contributors-preview', function () {
			$(this).parents('.kanban-list-card-detail').find('.contributor-container').slideToggle({ duration: 100 });
		}).on('click', '.kanban-list-card-detail:not(.dragging) .card-action', function () {
			var self = $(this);
			var card_dom = self.parents('.kanban-list-card-detail');
			var data = card_dom.data('datum');
			self.tooltip('hide');
			if (typeof self.data('action') === 'string' && typeof settings[self.data('action')] === 'function')
				settings[self.data('action')](data, card_dom);
		}).on('click', '.kanban-list-card-detail:not(.dragging) .card-duplicate', function () {
			var self = $(this);
			duplicateCard(self.parents('.kanban-list-card-detail'));
		}).on('click', '.kanban-new-card-button', function () {
			var columnId = $(this).data('column');
			var wrapperDom = $('#kanban-wrapper-' + columnId);
			wrapperDom.find('.kanban-list-cards').append(buildNewCardInput(kanban_object, columnId));
			wrapperDom.find('.js-card-title').focus();
			wrapperDom.find('.js-add-card').data('kanban_object', kanban_object);
			if (typeof settings.onInsertCardAction === 'function') {
				settings.onInsertCardAction(columnId);
			}
		}).on('click', '.js-add-card', on_add_card_clicked).on('click', '.kanban-action-dropdown .dropdown-trigger', function () {
			$(this).next('.dropdown-list').toggleClass('open');
		}).on('click', '.kanban-action-dropdown .dropdown-list.open .dropdown-item', function () {
			var self = $(this);
			var wrapperDom, headerEditorDom;
			switch (self.data('target')) {
				case 'add-card':
					wrapperDom = self.parents('.kanban-list-wrapper');
					var column = wrapperDom.data('column');
					wrapperDom.find('.kanban-list-cards').prepend(buildNewCardInput(kanban_object, column)).scrollTop(0);
					wrapperDom.find('.js-card-title').focus();
					wrapperDom.find('.js-add-card').data('kanban_object', kanban_object);
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
			kanban_object.trigger('click');
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
			var activeDropdownDomList = kanban_object.find('.dropdown-list.open');
			var visibleHeaderEditor = kanban_object.find('.column-header-editor').filter(function () {
				return $(this).is(':visible');
			});
			if (activeDropdownDomList.length && $(event.target).parents('.kanban-action-dropdown').length === 0) {
				activeDropdownDomList.removeClass('open');
			}
			var cancelWhenClass = ['column-header-text', 'column-header-editor', 'dropdown-item', 'kanban-new-column'];
			if (visibleHeaderEditor.length && cancelWhenClass.every(function (oneClass) { return !$(event.target).hasClass(oneClass) })) {
				var settings = kanban_object.data('settings');
				var column = visibleHeaderEditor.parents('.kanban-list-wrapper').data('column').toString();
				var headerIndex = settings.headers.findIndex(function (oneHeader) {
					return oneHeader.id === column;
				});
				settings.headers[headerIndex].label = visibleHeaderEditor.val();
				kanban_object.data('settings', settings);
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
				kanban_object.trigger('click');
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
			kanban_object.append(self);
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
						if (typeof _drag_and_drop_manager.on_column_drop === 'function') {
							_drag_and_drop_manager.on_column_drop(draggingElement, kanban_object);
						}
						bindDragAndDropEvents(kanban_object, _drag_and_drop_manager);
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
			if (dragstartColumn && !isPointerInsideOf(kanban_object.get(0), coordinates)) {
				kanban_object.trigger('mouseup');
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
			var containerDom = kanban_object.find('.kanban-container').length ? kanban_object.find('.kanban-container').get(0) : null;
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

		kanban_object.addClass('kanban-initialized');

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
			kanban_object.css('overflow-x', '');
		}).on('click', '.js-add-card', on_add_card_clicked).on('keydown', '.card-composer', function (event) {
			if (event.originalEvent.key === 'Enter') {
				event.preventDefault();
				$(this).find('.js-add-card').trigger('click');
			}
		});

		if (typeof settings.onRenderDone === 'function') {
			settings.onRenderDone();
		}
	}

	function initKanban(kanban_object) {
		var settings = kanban_object.data('settings');
		kanban_object.empty().html('');
		kanban_object.append($('<div>', {
			'class': 'kanban-container'
		}));
		if (settings.language === 'en') {
			loadKanban(kanban_object);
		} else {
			loadTranslation(settings.language, settings.endpoint ? settings.endpoint : null).then(function () {
				loadKanban(kanban_object);
			});
		}
	}

	$.fn.kanban = function (options, argument) {
		options = typeof options === 'undefined' ? {} : options;
		var Self = this, settings;
		Self.data('matrix', typeof Self.data('matrix') === 'object' ? Self.data('matrix') : {});
		Self.data('settings', typeof Self.data('settings') === 'object' ? Self.data('settings') : {});
		Self.data('filter', typeof Self.data('filter') === 'object' ? Self.data('filter') : {});
		if (typeof options === 'object' && !Self.hasClass('kanban-initialized')) {
			var defaultOptions = {
				headers: [],
				data: [],
				defaultColumnMenus: [],
				canEditHeader: false,
				prepend_only: false,
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
			Self.data('settings', settings);
			Self.data('matrix', {});
			initKanban(Self);
		} else if (typeof options === 'string' && (typeof argument !== 'undefined' || ['destroy'].includes(options))) {
			settings = Self.data('settings');
			var index, filter, matrix, column, data, matrixData, createcard_dom;
			switch (options) {
				case 'setData':
					matrixData = $.extend({}, Self.data('matrix'));
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
								var action_dom = Self.find('.kanban-list-card-detail[data-id="' + action.id + '"] .card-action[data-action="' + action.action + '"]');
								action_dom
									.tooltip({ title: action.bstooltip.text.replace(/"/g, '&quot;') })
									.tooltip('show');
							}
						});
						Self.data('matrix', matrixData);
						filter = Self.data('filter');
						matrixData = filterMatrixBy(matrixData, filter);
						var oldcard_dom = Self.find('.kanban-list-card-detail[data-id="' + argument.id + '"]');
						if (oldcard_dom.length) {
							oldcard_dom.after(buildCard({ data: data, settings: settings }));
							oldcard_dom.remove();
						}
						bindDragAndDropEvents(Self, _drag_and_drop_manager);
						if (typeof settings.onRenderDone === 'function') {
							settings.onRenderDone();
						}
					}
					break;
				case 'addData':
					var dataToAdd = Array.isArray(argument) ? argument : [argument];
					addData(Self, dataToAdd);
					matrix = Self.data('matrix');
					filter = Self.data('filter');
					matrix = filterMatrixBy(matrix, filter);
					dataToAdd.forEach(function (datumLoop) {
						if (typeof datumLoop.id === 'undefined' || typeof datumLoop.header === 'undefined') {
							return true;
						}
						var index = get_data_matrix_index(datumLoop, matrix);
						if (index >= 0)
							Self.find('#kanban-wrapper-' + datumLoop.header + ' .kanban-list-cards').append(buildCard({
								data: matrix[datumLoop.header][index],
								settings: settings
							}));
					});
					bindDragAndDropEvents(Self, _drag_and_drop_manager);
					if (typeof settings.onRenderDone === 'function')
						settings.onRenderDone();
					break;
				case 'deleteData':
					var deletedId = deleteData(Self, argument);
					matrix = Self.data('matrix');
					filter = Self.data('filter');
					matrix = filterMatrixBy(matrix, filter);
					if (deletedId !== null) {
						createcard_dom = Self.find('.kanban-list-card-detail[data-id=' + deletedId + ']');
						createcard_dom.remove();
						bindDragAndDropEvents(Self, _drag_and_drop_manager);
						if (typeof settings.onRenderDone === 'function')
							settings.onRenderDone();
					}
					break;
				case 'getData':
					matrixData = $.extend({}, Self.data('matrix'));
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
				case 'filter':
					filter = argument;
					matrix = $.extend({}, Self.data('matrix'));
					Self.data('filter', filter);
					matrix = filterMatrixBy(matrix, filter);
					do_build_cards(Self, matrix);
					bindDragAndDropEvents(Self, _drag_and_drop_manager);
					if (typeof settings.onRenderDone === 'function') {
						settings.onRenderDone();
					}
					break;
				case 'moveCard':
					createcard_dom = Self.find('.kanban-list-card-detail[data-id="' + argument.id + '"]');
					matrix = Self.data('matrix');
					if (createcard_dom.length === 0) {
						for (column in matrix) {
							index = matrix[column].findIndex(function (datum) {
								return datum.id === argument.id;
							});
							if (index >= 0)
								break;
						}
						data = matrix[column][index];
						argument.position = typeof argument.position === 'number' ? argument.position : matrix[column].length;
						createcard_dom = buildCard({ data: data, settings: settings });
						createcard_dom.hide();
					} else
						argument.position = typeof argument.position === 'number' ? argument.position : matrix[argument.target].length;
					do_move_card(Self, createcard_dom, argument.target, argument.position);
					_drag_and_drop_manager.on_card_drop(createcard_dom, Self, typeof argument.notify === 'boolean' ? argument.notify : false);
					break;
				case 'destroy':
					if (typeof settings.onDestroy === 'function')
						settings.onDestroy();
					Self.removeClass('kanban-initialized');
					Self.removeData();
					Self.empty().html('');
					break;
			}
		}
		W.addEventListener('resize', function () {
			mediaQueryAndMaxWidth(Self, 770);
		});
		return this;
	};
})(jQuery, window);
