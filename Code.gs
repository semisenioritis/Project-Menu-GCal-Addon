const NOTION_TOKEN = 'ntn_1234567890qwertyuiop'; // replace with your integration token
const NOTION_DB_ID = 'qwertyuiop1234567890'; // replace with your database ID


const DISPLAY_PROPS=['Sub module','Project','Time','Notes/Links'];
const ICONS={
  'Project':'https://fonts.gstatic.com/s/i/materialicons/folder/v18/24px.svg',
  'Time':'https://fonts.gstatic.com/s/i/materialicons/schedule/v20/24px.svg',
  'Notes/Links':'https://fonts.gstatic.com/s/i/materialicons/link/v14/24px.svg'
};

// Order of time groups
const TIME_ORDER = [
  '30 min',
  'Under 1 hr',
  '1 to 2 hr',
  'More than 2 hrs',
  'More than 5 hrs'
];

const TIME_SUFFIX_MAP = {
  '30 min': '(0.5h)',
  'Under 1 hr': '(1h)',
  '1 to 2 hr': '(2h)',
  'More than 2 hrs': '(5h)',
  'More than 5 hrs': '(8h)'
};

const INDENT = '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0';  // three NBSPs
const COLOR_DOT = '🔵';
function fetchNotionRows(){
  let all=[], cursor=null;
  const url=`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`;
  do{
    const payload={page_size:100};
    if(cursor) payload.start_cursor=cursor;
    const res=UrlFetchApp.fetch(url,{
      method:'post',
      headers:{
        Authorization:`Bearer ${NOTION_TOKEN}`,
        'Notion-Version':'2022-06-28',
        'Content-Type':'application/json'
      },
      payload:JSON.stringify(payload),
      muteHttpExceptions:true
    });
    const j=JSON.parse(res.getContentText());
    all=all.concat(j.results);
    cursor=j.next_cursor;
  }while(cursor);
  return all;
}

function formatProp(p){
  switch(p.type){
    case'checkbox': return p.checkbox?'✔️':'✖️';
    case'date': return p.date?.start||'';
    case'multi_select': return p.multi_select.map(x=>x.name).join(', ');
    case'select': return p.select?.name||'';
    case'number': return p.number;
    case'url': return p.url;
    case'email': return p.email;
    case'phone_number': return p.phone_number;
    case'rich_text': return p.rich_text.map(x=>x.plain_text).join('');
    case'title': return p.title.map(x=>x.plain_text).join('');
    case'formula':
      const f=p.formula;
      if(f.string!=null) return f.string;
      if(f.number!=null) return f.number;
      if(f.boolean!=null) return f.boolean?'✔️':'✖️';
      if(f.date) return f.date.start;
      return '';
    case'relation': return p.relation.map(r=>r.id).join(', ');
    case'rollup':
      const rv=p.rollup;
      if(Array.isArray(rv.array)) return rv.array.map(i=>i.plain_text||i.name||i.number).join(', ');
      if(rv.number!=null) return rv.number;
      if(rv.string!=null) return rv.string;
      return '';
    default: return '';
  }
}

function addToTasks(e) {
  const title = e.parameters.title;
  const suffix = e.parameters.suffix || '';
  const notes = e.parameters.notes || '';  // Notes/Links content
  const taskListId = 'qwertyuiopasdfghjkl'; // or a specific list ID

  const task = {
    title: title + " " + suffix,
    notes: notes
    // you can also set due: '2025-05-07T10:00:00.000Z', notes, etc.
  };

  Tasks.Tasks.insert(task, taskListId);

  // Optional: return a notification toast to the user
  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification()
        .setText(`Added "${title}" to your Tasks`)
    )
    .build();
}


function onHomepage(e){
  const rows=fetchNotionRows();

  // Group rows by the 'Time' property
  const groupedByTime = rows.reduce((groups, row) => {
    const time = formatProp(row.properties['Time']); // Get the 'Time' value
    if (TIME_ORDER.includes(time)) { // Only include valid Time values
      if (!groups[time]) {
        groups[time] = []; // Create a new group if it doesn't exist
      }
      groups[time].push(row); // Add the current row to the corresponding time group
    }
    return groups;
  }, {});

  // Create a new card builder
  const card = CardService.newCardBuilder()
    

  // Render each group of tasks based on the predefined order
  TIME_ORDER.forEach(timeGroup => {
    if (groupedByTime[timeGroup]) { // Only render groups with tasks
      const section = CardService.newCardSection()
        .setHeader(`<b> ${COLOR_DOT} ${timeGroup}</b>`); // Set the time group as the section header
        section.addWidget(CardService.newDivider());
        section.addWidget(CardService.newDivider());
    
      // Render each task in this time group
      groupedByTime[timeGroup].forEach(row => {
        const timeValue = formatProp(row.properties['Time']);
        const suffix = TIME_SUFFIX_MAP[timeValue] || '';
        const taskTitle = formatProp(row.properties['Sub module']) || 'Untitled';
        const notesLinks = formatProp(row.properties['Notes/Links']) || '';


        // Add task title (bold)
section.addWidget(
  CardService.newDecoratedText()
    .setText(`<b>${INDENT}${taskTitle}</b>`)
    .setOnClickAction(
      CardService.newAction()
        .setFunctionName('addToTasks')
        .setParameters({ title: taskTitle,
              notes: notesLinks,
              suffix: suffix })
    )
    .setWrapText(true)
);

        // Add the properties for this task
        DISPLAY_PROPS.forEach(name => {
          if (name === 'Sub module') return;
          const prop = row.properties[name];
          const value = prop ? formatProp(prop) : '';
          section.addWidget(
            CardService.newDecoratedText()
              .setIconUrl(ICONS[name])
              .setTopLabel(name)
              .setText(value)
              .setWrapText(true)
          );
        });
                // Add line break after each task
        section.addWidget(CardService.newDivider());
        section.addWidget(CardService.newDecoratedText().setText("<br>"));
      });

      // Add the section to the card
      card.addSection(section);
    }
  });

  return card.build();
}
