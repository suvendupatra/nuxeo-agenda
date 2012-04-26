var prefs = new gadgets.Prefs();
var divContent, divTools;

function log(txt) {
	console.log(txt)
}

function initAgenda() {
	moment.lang('en') // set 'en' first, to prevent from DE as default.
	moment.lang(prefs.getLang())
	divContent = jQuery("#content");
	divTools = jQuery("div.tools");
	initContextPanel(divTools)
}

function displayCalendar() {

	divContent.fadeOut(300, function() {
		divContent.empty();
		divContent.fadeIn(300, function() {
			gadgets.window.adjustHeight();
		});
		jQuery('<div id="calendar" />').appendTo(divContent).fullCalendar({
			theme: true,
			timeFormat: 'H(:mm)',
			header: {
				left: 'prev,next today',
				center: 'title',
				right: 'month,agendaWeek,agendaDay'
			},
			events: function(start, end, callback) {
				fetchEvent({
					dtStart: start,
					dtEnd: end
				}, function(entries, nxParams) {
					var events = [];
					for (var index in entries) {
						var entry = entries[index];

						var dtStart = moment(entry.properties["vevent:dtstart"])
						var dtEnd = moment(entry.properties["vevent:dtend"])
						var allDay = dtEnd.diff(dtStart, 'days') > 0;
						events.push({
							title: entry.properties["dc:title"],
							start: entry.properties["vevent:dtstart"],
							end: entry.properties["vevent:dtend"],
							allDay: allDay
						})
					}

					callback(events)
				})
			}
		});
	});
}

function initCreateEvent() {
	divContent.fadeOut(300, function() {
		divContent.empty();
		var form = jQuery("<form />").submit(function(eventObject) {
			var formParams = $(this).serializeArray();
			var params = {}
			for (var index in formParams) {
				var field = formParams[index];
				if (field.value) {
					params[field.name] = field.value
				}
			}

			createEvent(params, createEventCallback)
			return false;
		});

		jQuery('<span>Summary: </span><input type="text" name="summary" /><br/>').appendTo(form)
		jQuery('<span>Description: </span><input type="text" name="description" /><br/>').appendTo(form)
		jQuery('<span>dtStart: </span><input type="text" name="dtStart" class="inputDate"/><br/>').appendTo(form);
		jQuery('<span>dtEnd: </span><input type="text" name="dtEnd" class="inputDate" /><br/>').appendTo(form)
		jQuery('<span>Location: </span><input type="text" name="location" /><br/>').appendTo(form)
		jQuery('<input type="submit" value="submit" /><br/>').appendTo(form)
		form.appendTo(divContent)
		divContent.fadeIn(300, function() {
			gadgets.window.adjustHeight();
			form.children(".inputDate").datepicker({
				dateFormat: 'yy-mm-dd'
			});
		});
	});
}

function initContextPanel(node) {
	// Create Plus div
	var newEvent = jQuery("<div />")
	jQuery("<a />").attr('href', '#').click(initCreateEvent).html("Add").appendTo(newEvent);
	node.append(newEvent);

	// Create filter div
	var parag = jQuery("<div>Filter: </div>")
	var values = ["daily", "weekly", "monthly"]
	var clickHandler = function(value) {
			return function(event) {
				fetchEventWithFade(buildListOperationParams(value));
				var target = jQuery(event.target);
				target.parent().children().each(function(child) {
					jQuery(this).removeClass("selected")
				})
				jQuery(event.target).addClass('selected')

				return false;
			}
		};

	for (var index in values) {
		if (index != 0) {
			parag.append("<span>&nbsp;/&nbsp;</span>")
		}
		var currNode = jQuery("<a/>").attr('href', '#').click(clickHandler(values[index])).html(values[index]);
		if (index == 0) {
			currNode.addClass('selected')
		}
		parag.append(currNode);
	}
	node.append(parag)

	// Create calendar div
	var all = jQuery("<div />")
	jQuery("<a />").attr('href', '#').click(displayCalendar).html(">> see calendar").appendTo(all);
	node.append(all);

	gadgets.window.adjustHeight();
}

function buildListOperationParams(period) {
	var dtStart = moment().sod(),
		dtEnd;

	var addTime;
	switch (period) {
	case 'monthly':
		addTime = 'months'
		break;
	case 'weekly':
		addTime = 'weeks'
		break;
	case 'daily':
	default:
		addTime = 'days'
		break;
	}

	dtEnd = moment(dtStart).add(addTime, 1)
	return {
		dtStart: dtStart.toDate(),
		dtEnd: dtEnd.toDate()
	}
}

function fillTables(table, entries) {
	table.empty()
	var now = moment()

	for (var index in entries) {
		var entry = entries[index]

		var dtStart = moment(entry.properties["vevent:dtstart"])
		var dtEnd = moment(entry.properties["vevent:dtend"])
		var currState = 'near'
		if (now.diff(dtStart) >= 0) {
			if (now.diff(dtEnd) >= 0) {
				currState = 'done'
			} else {
				currState = 'inProgress'
			}
		}

		var tr = jQuery("<tr/>").addClass(currState)
		tr.append("<td>" + entry.properties["dc:title"] + "</td>");
		tr.append("<td>" + dtStart.calendar() + "</td>");
		tr.append("<td>" + dtEnd.calendar() + "</td>");
		tr.append("<td>" + entry.properties["vevent:location"] + "</td>");
		table.append(tr);
	}
}

function mkTable(nodeId) {
	var table = jQuery("<table/>").attr('id', nodeId);
	return table.appendTo(divContent);
}

function mkBanner(nodeId) {
	var banner = jQuery("<h2/>").attr('id', nodeId)
	return banner.appendTo(divContent);
}

function findOrCreate(nodeId, creationMethod) {
	var charly = jQuery("#" + nodeId),
		ret;
	if (charly.length <= 0) {
		charly = creationMethod(nodeId);
	}
	return charly;
}

function displayEvents(entries, nxParams) {
	divContent.empty()
	if (entries && entries.length <= 0) {
		divContent.html = '<p>' + nxParams.noEntryLabel + '</p>';
	} else {
		// Fill between banner
		var banner = findOrCreate('betweenBanner', mkBanner)
		var pattern = "ddd, LL";
		var dtStart = moment(nxParams.operationParams.dtStart).format(pattern);
		var dtEnd = moment(nxParams.operationParams.dtEnd).format(pattern);

		banner.html("Events between " + dtStart + " and " + dtEnd);

		// Fill Results Table
		var tableResults = findOrCreate("agenda", mkTable);
		fillTables(tableResults, entries)
	}
	divContent.fadeIn(300, function() {
		gadgets.window.adjustHeight();
	})
}

function operationExecutedCallback(response, params) {
	console.log("Operation executed")
}

function createEventCallback(response, params) {
	jQuery("#waitMessage").empty();
	jQuery("#errorMessage").empty();
	jQuery('#debugInfo').empty();
	log("Create Event Callback")
	log(response)
	if (response.rc >= 500) {
		//Server error
		log(response)
	} else {
		fetchEventWithFade(buildListOperationParams())
	}
	log(response)
}

function fetchEventWithFade(params, displayMethod) {
	divContent.fadeOut(300, function() {
		fetchEvent(params, displayMethod)
	})
}

function fetchEvent(params, displayMethod) {
	var internalDisplayMethod = displayMethod || displayEvents;

	// Automation requests
	var NXRequestEventsParams = {
		operationId: 'VEVENT.List',
		operationParams: params,
		entityType: 'documents',
		operationContext: {},
		operationDocumentProperties: "dublincore,vevent",
		operationCallback: operationExecutedCallback,
		displayMethod: internalDisplayMethod,
		noEntryLabel: prefs.getMsg('label.gadget.no.document')
	};

	doAutomationRequest(NXRequestEventsParams)
}

function createEvent(params, callback) {
	params = params || {}
	callback = callback || operationExecutedCallback;
	params['contextPath'] = getTargetContextPath();

	// Automation requests
	var NXRequestEventsParams = {
		operationId: 'VEVENT.Create',
		operationParams: params,
		operationContext: {},
		operationCallback: callback
	};

	doAutomationRequest(NXRequestEventsParams)
}

// execute automation request onload
gadgets.util.registerOnLoadHandler(function() {
	initAgenda()
	fetchEventWithFade(buildListOperationParams())
});