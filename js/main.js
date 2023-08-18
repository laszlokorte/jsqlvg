const rootEl = document.querySelector('#app-root');
const canvasEl = document.createElement('canvas');
const svgEl = document.createElementNS("http://www.w3.org/2000/svg",'svg');
const svgElWorld = document.createElementNS("http://www.w3.org/2000/svg",'svg');
const errorEl = document.createElement('div');

rootEl.classList.add('layout-zstack','full-size')
canvasEl.classList.add('draw-target','layout-zstack-item')
svgEl.classList.add('draw-target','layout-zstack-item')
svgElWorld.classList.add('draw-target','layout-zstack-item','no-mouse')
errorEl.classList.add('error-report','layout-zstack-item')

svgEl.setAttribute('preserveAspectRatio', 'xMidYMid slice')
svgElWorld.setAttribute('preserveAspectRatio', 'xMidYMid slice')

rootEl.appendChild(canvasEl)
rootEl.appendChild(svgEl)
rootEl.appendChild(svgElWorld)
rootEl.appendChild(errorEl)
svgEl.style.zIndex = 888
svgElWorld.style.zIndex = 888
errorEl.style.zIndex = 999

const svgPoint = svgEl.createSVGPoint()
const svgPointWorld = svgElWorld.createSVGPoint()

function eventXY(event) {
	var ctm = svgEl.getScreenCTM();
	svgPoint.x = event.clientX;
	svgPoint.y = event.clientY;
	let {x,y} = svgPoint.matrixTransform(ctm.inverse());

	return {x,y}
}


function eventXYWorld(event) {
	var ctm = svgElWorld.getScreenCTM();
	svgPoint.x = event.clientX;
	svgPoint.y = event.clientY;
	let {x,y} = svgPoint.matrixTransform(ctm.inverse());

	return {x,y}
}


let w=0,h=0
function resize() {
	w = window.innerWidth
	h = window.innerHeight

	canvasEl.width = w*2
	canvasEl.height = h*2
	svgEl.setAttribute('width', w)
	svgEl.setAttribute('height', h)
}

resize()
window.addEventListener('resize', resize)
window.onerror = (msg, url, lineNo, columnNo, error) => {
	errorEl.innerText = `Error: ${lineNo}:${columnNo} in ${url}: ${msg}`
}

function fetchOne(db, sql) {
	const stmt = db.prepare(sql);
	stmt.step()
	const result = stmt.getAsObject()
	stmt.free()
	return result;
}

function fetchAll(db, sql) {
	const stmt = db.prepare(sql);
	const results = []
	while(stmt.step())
		results.push(stmt.getAsObject())
	stmt.free()

	return results;
}


function render(db) {
	const selected = fetchAll(db, "SELECT element_id FROM ui_selection  WHERE ui_viewport_id=1").map((e)=>e.element_id)
	const points = fetchAll(db, "SELECT id, x, y, size, color FROM test")
	const nodes = fetchAll(db, "SELECT * FROM view_bounded_node_in_viewport WHERE viewport_id=1 AND in_viewport");
	const anchors = fetchAll(db, "SELECT * FROM view_bounded_anchor_in_viewport WHERE viewport_id=1 AND in_viewport");
	const texts = fetchAll(db, "SELECT * FROM view_bounded_text_in_viewport WHERE viewport_id=1 AND in_viewport");
	const edges = fetchAll(db, "SELECT * FROM view_bounded_edge_in_viewport WHERE viewport_id=1 AND in_viewport");
	const selectBoxs = fetchAll(db, "SELECT * FROM ui_selection_box WHERE ui_viewport_id=1");
	const viewport = fetchOne(db, "SELECT * FROM view_bounded_ui_viewport WHERE id=1");
	svgEl.setAttribute('viewBox', `${viewport.min_x} ${viewport.min_y} ${viewport.width} ${viewport.height}`);
	svgElWorld.setAttribute('viewBox', `${viewport.world_min_x} ${viewport.world_min_y} ${viewport.world_width} ${viewport.world_height}`);
	const scaleFactor = Math.max(canvasEl.width/viewport.width, canvasEl.height/viewport.height)
	const ctx = canvasEl.getContext("2d")	
	ctx.clearRect(0,0, canvasEl.width, canvasEl.height)
	ctx.save()
	ctx.translate(canvasEl.width/2, canvasEl.height/2)
	ctx.scale(scaleFactor, scaleFactor)

	ctx.fillStyle = '#feea'
	ctx.strokeStyle = '#faa'
	ctx.lineWidth=1
	ctx.fillRect(viewport.min_x, viewport.min_y, viewport.width, viewport.height)
	ctx.strokeRect(viewport.min_x, viewport.min_y, viewport.width, viewport.height)

	ctx.fillStyle = 'gray'
	ctx.strokeStyle = 'black'
	ctx.lineWidth = Math.min(1,viewport.scale)
	
	ctx.beginPath()
	for(let node of nodes) {
		ctx.rect(node.min_x, node.min_y, node.width, node.height)
	}
	ctx.fill()
	ctx.stroke()

	ctx.strokeStyle = 'blue'
	ctx.beginPath()
	ctx.lineWidth = 0.9
	for(let edge of edges) {
		//ctx.rect(edge.min_x, edge.min_y, edge.max_x-edge.min_x, edge.max_y-edge.min_y)

		ctx.moveTo(edge.source_x, edge.source_y)
		for(let p of JSON.parse(edge.points)) {
			ctx.lineTo(p.x, p.y)
			//ctx.fillText(edge.element_id, p.x, p.y)
		}
		ctx.lineTo(edge.target_x, edge.target_y)
	}
	ctx.stroke();

	ctx.fillStyle = 'black'
	ctx.textAlign="center"
	ctx.textBaseline="middle"

	for(let text of texts) {
		ctx.font = `normal ${text.font_size_relative}px serif`;
		ctx.fillText(text.content, text.center_x, text.center_y)
	}


	ctx.fillStyle = '#0af2'
	ctx.strokeStyle = '#07da'

	ctx.beginPath()
	for(let selectBox of selectBoxs) {
		ctx.rect(selectBox.start_x, selectBox.start_y, selectBox.end_x-selectBox.start_x, selectBox.end_y-selectBox.start_y)
	}
	ctx.fill()
	ctx.stroke()

	ctx.strokeStyle = '#07da'
	ctx.lineWidth=Math.max(2, 2*viewport.scale)
	ctx.lineJoin="round"
	ctx.lineCap="round"

	ctx.beginPath()
	for(let node of nodes) {
		if(!selected.includes(node.element_id)) {
			continue
		}
		ctx.rect(node.min_x, node.min_y, node.width, node.height)
	}
	ctx.fill()
	for(let edge of edges) {
		if(!selected.includes(edge.element_id)) {
			continue
		}

		ctx.moveTo(edge.source_x, edge.source_y)
		for(let p of JSON.parse(edge.points)) {
			ctx.lineTo(p.x, p.y)
		}
		ctx.lineTo(edge.target_x, edge.target_y)
	}
	ctx.stroke()
	for(let text of texts) {
		if(!selected.includes(text.element_id)) {
			continue
		}
		ctx.font = `normal ${text.font_size_relative}px serif`;
		ctx.strokeText(text.content, text.center_x, text.center_y)
	}


	ctx.fillStyle = 'orange'
	ctx.strokeStyle = 'darkorange'
	ctx.lineWidth = Math.min(1,viewport.scale)

	ctx.beginPath()
	for(let anchor of anchors) {
		ctx.roundRect(anchor.min_x, anchor.min_y, anchor.width, anchor.height, 5*viewport.scale)
	}
	ctx.fill()
	ctx.stroke()

	ctx.restore()
}

function loadScript(path) {
	return new Promise((resolve, reject) => {
		const opScript = document.createElement('script')
		opScript.async = true
		opScript.onload = () => resolve()
		opScript.onerror = () => reject()
		opScript.src = path
		document.head.appendChild(opScript)
	})
}

function loadText(path) {
	return window.fetch(path).then(s=>s.text())
}

Promise.all([initSqlJs({}), loadText('schema/main.sql'), loadScript('schema/operations.js')]).then(function([SQL, schema]){
	const db = new SQL.Database();
	const stmt = db.exec(schema);

	loadExamples(db)

	function doInsert(x,y,size,color) {
		createNode(db, x,y, 1)
		requestReload()
	}


	let reloading
	function requestReload() {
		if(!reloading){
			reloading = window.requestAnimationFrame(doReload)
		}
	}

	function doReload() {
		reloading = null
		render(db)
	}

	requestReload();

	window.addEventListener('resize', requestReload);

	;(() => {
		let dragging = null
		let dragged = 0

		function startDragging(evt) {
			dragged = 0
			const xy = eventXY(evt)
			dragging = {
				start: xy,
				prev: xy,
				button: evt.button,
			}

			if(evt.button==0) {
				startSelect(db, xy.x, xy.y)
				requestReload()
			}

			moveDragging(evt)
			evt.preventDefault()
		}

		function stopDragging(evt) {
			if(dragging&&dragging.button==0) {
				stopSelect(db)
				requestReload()
			}
			dragging = null
		}

		function moveDragging(evt) {
			if(!dragging) {
				return
			}
			if(dragging.button==1 && dragged++ > 2) {
				const {x,y} = eventXY(evt)
				doPan(db, x-dragging.prev.x, y-dragging.prev.y)

				dragging.prev = {x,y}
				requestReload()
			} else if(dragging.button==0 && dragged++ > 2) {
				const {x,y} = eventXY(evt)

				updateSelect(db, x, y)

				dragging.prev = {x,y}
				requestReload()
			}
		}

		function click(evt) {
			if(dragged > 2) {
				return
			}
			const {x,y} = eventXYWorld(evt)

			const hit = hitTest(db, x,y);
			if(!hit) {
				clearSelect(db)
				doInsert(x, y, 5, "#4af")
			} else {
				clearSelect(db)
				addSelect(db, hit.element_id)
			}
		}

		function zoom(evt) {
			const center = eventXY(evt)
			doZoom(db, Math.pow(2, -Math.sign(evt.deltaY)/4), center)
			requestReload(db)
		}

		svgEl.addEventListener("click", click, false);
		svgEl.addEventListener("dblclick", click, false);
		svgEl.addEventListener("pointerdown", startDragging, false);
		window.addEventListener("pointerup", stopDragging, false);
		window.addEventListener("pointercancel", stopDragging, false);
		window.addEventListener("pointermove", moveDragging, false);
		svgEl.addEventListener("wheel", zoom, false);

		const menu = document.createElement('menu');
		const menuItems = [
			{label: 'Clear', action: () => {
				clearElements(db)
				requestReload()
			}},
			{label: 'Delete Selected', action: () => {
				deleteSelected(db)
				requestReload()
			}}
		]

		for(let item of menuItems) {
			const menuItemClear = document.createElement('li')
			const menuButtonClear = document.createElement('button')
			menuItemClear.appendChild(menuButtonClear)
			menu.appendChild(menuItemClear)
			rootEl.appendChild(menu)
			menu.classList.add('menu', 'layout-zstack-item')
			menuButtonClear.classList.add('menu-button')
			menuButtonClear.appendChild(document.createTextNode(item.label))
			menuButtonClear.addEventListener('click', item.action)
		}
	})()
})

