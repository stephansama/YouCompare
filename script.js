// =====================================
// Stephan Randle (GA) - Project Unit 1
// 12/10/21
// =====================================
//
// Accept user input inside a text field
// Submit query to YouTube Data API
// retrieve 5 possible YouTube videos
// once a result video is selected add it to local queue
// load google chart with local queue data
// update local queue to the window storage for persistence
// clear button to fade out and remove all queue item elements
// download button to download unnamed json file containing all the YouTube data
//
$(function () {
    /** GLOBAL VARIABLES **/
    // YouTube Data API Key
    const API = 'AIzaSyB9-3f8Dlx5-VOfcr_GCtocfwwMFSxwcq8'
    // const API = 'AIzaSyANIJpTgj86KjrZvtD7NyHjfKPKgwxIu-U'

    // Template strings
    const STATISTICS_API_TEMPLATE = 'https://www.googleapis.com/youtube/v3/videos?part=statistics&id=[QUERY]&key=[API]'
    const SEARCH_API_TEMPLATE = 'https://youtube.googleapis.com/youtube/v3/search?type=video&part=snippet&q=[QUERY]&key=[API]'
    const YTCHANNEL_TEMPLATE = 'https://www.youtube.com/channel/[ID]'
    const YTLINK_TEMPLATE = 'https://www.youtube.com/watch?v=[ID]'

    // Internal video object storage
    let result_videos = []
    let queue_videos = []

    // Global jQuery fade time
    const fadetime = 500

    // Google Chart options
    const gchartOptions = {
        pieSliceText: 'value',
        fontName: 'Inconsolata',
        chartArea: {left: 0},
        titleTextStyle: {fontSize: 24},
        legend: {position: 'bottom'}
    }

    /** DOM ELEMENTS **/
    const $input = $('input[type=text]')
    const $queue = $('#queue')
    const $submit = $('button[type=submit]')
    const $results = $('#results')
    const $viewChart = $('#view_chart')
    const $likeChart = $('#like_chart')

    /** LISTENER EVENTS **/

    // DOM listener events
    $results.on('click', 'img', handleSelectVideo)
    $submit.on('click', handleSubmitSearch)
    $queue.on('click', 'button#close', handleRemoveFromQueue)
    $queue.on('click', 'button#clear', handleClearButton)
    $queue.on('click', 'button#dwn', handleDownloadButton)
    $queue.on('click', 'img', handleShowTable)

    // window state change events
    $(window).resize(function () { drawGoogleCharts() })
    $('body').keypress(function () { $input[0].focus() })

    // window load
    $(document).ready(function () {
        // load global style & apply it to queue items
        extractColors()
        createQueueStyles()
        // initial statements
        initApplication()
    })

    // manage incoming ajax data into a combined data type
    class YVid {
        constructor(ajax_obj, idx) {
            this.idx = idx
            this.vid = ajax_obj.id.videoId
            this.title = ajax_obj.snippet.title
            this.channelId = ajax_obj.snippet.channelId
            this.publishTime = ajax_obj.snippet.publishTime
            this.description = ajax_obj.snippet.description
            this.channelTitle = ajax_obj.snippet.channelTitle
            this.thumbnailUrl = ajax_obj.snippet.thumbnails.high.url
        }

        addStats(ajax_obj) {
            this.viewCount = ajax_obj.statistics.viewCount
            this.likeCount = ajax_obj.statistics.likeCount
            this.commentCount = ajax_obj.statistics.commentCount
            this.favoriteCount = ajax_obj.statistics.favoriteCount
        }
    }

    /** INITIAL LOADING **/
    function initApplication() {
        // Load the Visualization API and the core chart package.
        google.charts.load('current', {'packages': ['corechart']})

        // Set a callback to run when the Google Visualization API is loaded.
        google.charts.setOnLoadCallback(drawGoogleCharts)

        loadWindowMemory()
    }

    /** GENERATOR FUNCTIONS **/
    function createAPILink(id, template = SEARCH_API_TEMPLATE) {
        return template.replace('[QUERY]', id).replace('[API]', API)
    }

    function createYTLink(videoId, template = YTLINK_TEMPLATE) {
        return template.replace('[ID]', videoId)
    }

    function createInfoTable(YObj, hidden = true) {
        return $(`<table style="display: ${hidden ? 'none' : 'block'};">`).html(`
        ${createTableRow('Channel', YObj.channelTitle, createYTLink(YObj.channelId, YTCHANNEL_TEMPLATE))}
        ${createTableRow('Title', YObj.title, createYTLink(YObj.vid))}
        ${createTableRow('Published', YObj.publishTime)}
        ${createTableRow('Description', YObj.description)}
        ${YObj.viewCount ? // only add viewCount if it is updated
            `${createTableRow('Views', YObj.viewCount)}
            ${createTableRow('Likes', YObj.likeCount)}` : ''}`)
            .addClass(hidden ? 'hide' : 'show')
    }

    function createTableRow(left, right, link="", blank=true){
        return `<tr><td>${left}</td>
        <td>${link ? `<a href="${link}" ${blank ? 'target="_blank"':''}>`:''}${right}</td></tr>`
    }

    /** Global Styling **/
    // apply Google Chart Colors to the queue items
    function createQueueStyles(repetitions = 4) {
        let istyle = $('<style>')
        let template = '#qitem:nth-child([n]){background-color: [val];}\n'
        let istylehtml = ''
        let index = 1  // compensate for clear and button area

        // iterate through the number of repetitions then go through all the available colors
        for (let i = 0; i < repetitions; i++)
            for (let k = 0; k < gchartOptions.colors.length; ++k)
                istylehtml += template
                    .replace('[n]', `${index++ + 1}`)
                    .replace('[val]', gchartOptions.colors[k])

        istyle.html(istylehtml)
        $('head').append(istyle)
    }

    // extract all colors from the global style and apply them to the Google Chart Options Object
    function extractColors() {
        let gStyle = getComputedStyle(document.documentElement)
        gchartOptions.colors = []
        for (let i = 0; i < 5; ++i) {
            let style = gStyle.getPropertyValue(`--main-color${i}`).replaceAll(' ', '')
            if (i < 4) gchartOptions.colors.push(style)
            if (i === 4) gchartOptions.backgroundColor = style
        }
    }

    /** INTERNAL SPACE MANAGEMENT **/
    function loadResults(data) {
        if ($results.html() !== null) $results.html('')
        for(let i = 0; i < data.items.length; ++i)
            result_videos.push(new YVid(data.items[i], i))
        renderAllResults()
    }

    function clearResults() {
        clearContainer('#ritem',$results)
        result_videos = []
    }

    function shuffleQueueClasses() {
        let t = document.querySelectorAll('#qitem')
        for (let i = 0; i < t.length; i++) {
            t[i].className = `${i}`
            queue_videos[i].idx = i
        }
    }

    /** WINDOW MEMORY **/
    function loadWindowMemory() {
        let json = window.localStorage.getItem('yt')
        if (json !== null) {
            queue_videos = JSON.parse(json)
            queue_videos.forEach(elem => renderQueueItem(elem))
        }
    }

    function updateLocalStorage() {
        window.localStorage.setItem('yt', JSON.stringify(queue_videos))
    }

    /** EVENT FUNCTIONS **/
    function handleSubmitSearch(evt) {
        evt.preventDefault()

        let ival = $input.val()
        if (ival === '')
            $results.html('<span>Need to insert valid input...</span>')
        else if (ival === '`test')
            $.getJSON('./assets/search.json', loadResults)
        else
            $.ajax(createAPILink($input.val())).then(loadResults, handleError)
        $input.val('')
    }

    function handleSelectVideo(evt) {
        renderQueue(result_videos[parseInt(evt.target.className)])
        clearResults()
    }

    function handleRemoveFromQueue(evt) {
        evt.preventDefault()

        let t = $(evt.target.parentNode).fadeOut(fadetime, function () {
            queue_videos.splice(parseInt(t[0].className), 1)
            t.remove()
            updateLocalStorage()
            drawGoogleCharts()
            shuffleQueueClasses()
            if (queue_videos.length === 0) $queue.html('')
        })
    }
    
    function handleClearButton(evt) {
        evt.preventDefault()

        clearContainer('#qitem', $queue)
        queue_videos = []

        updateLocalStorage()
        drawGoogleCharts()
    }
    
    function handleDownloadButton(evt) {
        evt.preventDefault()

        let data = "text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(queue_videos, null, 2));
        let link = $(`<a class="dwn" href="data:' + ${data} + '" download="${data.json}">download JSON</a>`)
            .appendTo('#clear_area')

        link[0].click()
        link.remove()
    }

    function handleError(error) {
        console.log(error)
        alert('Sorry an error occurred')
    }

    // show table
    function handleShowTable(evt) {
        let table = $(evt.target.parentNode).find('table')
        if (table[0].className === 'hide') {
            table[0].className = 'show'
            table.fadeIn(fadetime)
        } else {
            table[0].className = 'hide'
            table.fadeOut(fadetime)
        }
    }

    /** RENDERING FUNCTIONS **/
    
    function clearContainer(item_id, container) {
        let items = document.querySelectorAll(item_id)
        for (let i = 0; i < items.length; i++){
            let t = $(items[i]).fadeOut(fadetime, function (){
                t.remove()
                if(i === items.length - 1) container.html('')
            })
        }
    }

    // Render thumbnail to an element
    function renderThumbnail(YObj, elem) {
        let thumbnail = $(`<img alt="${YObj.title}" src="${YObj.thumbnailUrl}">`)
            .addClass(`${YObj.idx}`)
        elem.append(thumbnail)
    }

    // RESULT
    function renderResult(YObj) {
        let $ru = $('<div id="ritem">')
            .addClass(`${YObj.idx}`)
        renderThumbnail(YObj, $ru)
        $ru.append(createInfoTable(YObj, false))
        $results.append($ru)
    }

    function renderAllResults() {
        result_videos.forEach(elem => { renderResult(elem) })
    }

    // CLEAR BUTTON
    function renderClearButton() {
        let $cl = $('<div id="clear_area">')
            .append($('<button id="clear">').text('CLEAR'))
            .append($('<button id="dwn">').text('DOWNLOAD'))
        $queue.append($cl)
    }

    // QUEUE
    function renderQueueItem(YObj) {
        if($queue.html() === '') renderClearButton()
        let $qu = $('<div id="qitem">')
            .append($('<button id="close">').text('X'))
            .addClass(`${YObj.idx}`)

        renderThumbnail(YObj, $qu)

        $qu.append($(`<a href="${createYTLink(YObj.vid)}" target="_blank">`)
            .text(`${YObj.title.slice(0, 35)} ->`))
            .append(createInfoTable(YObj))

        $queue.append($qu)
    }

    function renderQueue(YObj) {
        YObj.idx = queue_videos.length // reassign id

        $.ajax(createAPILink(YObj.vid, STATISTICS_API_TEMPLATE)).then(function (data) {
            YObj.addStats(data.items[0])
            queue_videos.push(YObj)
            updateLocalStorage()
            drawGoogleCharts()
            renderQueueItem(YObj)
        }, handleError)
    }

    /** GOOGLE CHART FUNCTIONS **/
    function createDataTable(name = 'NULL', data = ['NULL', 0]) {
        let rdata = [['Title', name]]
        data.forEach(elem => rdata.push([elem[0], elem[1]]))
        return google.visualization.arrayToDataTable(rdata)
    }

    function drawGoogleCharts() {
        let data, chart

        // VIEW COUNT
        gchartOptions.title = 'Views'
        data = queue_videos.length === 0 ? createDataTable() :
            createDataTable('View', queue_videos.map(elem => {
                return [elem.title, parseInt(elem.viewCount)] }))
        chart = new google.visualization.PieChart($viewChart[0]);

        chart.draw(data, gchartOptions);

        // LIKE COUNT
        gchartOptions.title = 'Likes'
        data = queue_videos.length === 0 ? createDataTable() :
            createDataTable('Like', queue_videos.map(elem => {
                return [elem.title, parseInt(elem.likeCount)] }))
        chart = new google.visualization.PieChart($likeChart[0]);

        chart.draw(data, gchartOptions);
    }
})