import { useState, useEffect, useRef } from 'react';
import axiosClient from '../api/axiosClient';

// Simple regex-based SQL Syntax Highlighter
const highlightSQL = (text) => {
  if (!text) return '';

  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const placeholders = [];
  const addPlaceholder = (replacement) => {
    placeholders.push(replacement);
    return `___PH_${placeholders.length - 1}___`;
  };

  // 1. Hide Strings
  html = html.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (match) => {
    return addPlaceholder(`<span class="text-emerald-400">${match}</span>`);
  });

  // 2. Hide Comments
  html = html.replace(/(--.*$|\/\*[\s\S]*?\*\/)/gm, (match) => {
    return addPlaceholder(`<span class="text-gray-500 italic">${match}</span>`);
  });

  // 3. Highlight SQL Keywords
  const keywords = /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|ADD|COLUMN|KEY|PRIMARY|FOREIGN|REFERENCES|JOIN|LEFT|RIGHT|INNER|ON|GROUP|BY|ORDER|LIMIT|AND|OR|NOT|IN|LIKE|IS|NULL|AS|HAVING|UNION|ALL|SHOW|DESCRIBE|EXPLAIN|USE)\b/ig;
  html = html.replace(keywords, (match) => {
    return addPlaceholder(`<span class="text-primary-400 font-bold">${match.toUpperCase()}</span>`);
  });

  // 4. Highlight SQL Data Types
  const types = /\b(INT|VARCHAR|TEXT|BIGINT|TIMESTAMP|DATE|DATETIME|BOOLEAN|FLOAT|DOUBLE|DECIMAL|AUTO_INCREMENT)\b/ig;
  html = html.replace(types, (match) => {
    return addPlaceholder(`<span class="text-purple-400 font-semibold">${match.toUpperCase()}</span>`);
  });

  // 5. Highlight numbers
  html = html.replace(/\b(\d+)\b/g, (match) => {
    return addPlaceholder(`<span class="text-amber-400">${match}</span>`);
  });

  // 6. Restore all placeholders in reverse order
  for (let i = placeholders.length - 1; i >= 0; i--) {
    html = html.replace(`___PH_${i}___`, placeholders[i]);
  }

  return html;
};

// Parser to extract table name and columns from a CREATE TABLE query
const parseCreateTable = (sql) => {
  const match = sql.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_`]+)\s*\(([\s\S]*)\)/i);
  if (!match) return null;

  const tableName = match[1].replace(/`/g, '');
  const columnsBody = match[2];

  const columnLines = [];
  let currentLine = '';
  let parenDepth = 0;
  for (let i = 0; i < columnsBody.length; i++) {
    const char = columnsBody[i];
    if (char === '(') parenDepth++;
    if (char === ')') parenDepth--;
    if (char === ',' && parenDepth === 0) {
      columnLines.push(currentLine.trim());
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    columnLines.push(currentLine.trim());
  }

  const columns = columnLines
    .map(line => {
      const upper = line.toUpperCase().trim();
      if (upper.startsWith('PRIMARY KEY') || 
          upper.startsWith('FOREIGN KEY') || 
          upper.startsWith('CONSTRAINT') || 
          upper.startsWith('KEY') || 
          upper.startsWith('INDEX') ||
          upper.length === 0) {
        return null;
      }
      
      const tokens = line.trim().split(/\s+/);
      if (tokens.length < 2) return null;
      
      const columnName = tokens[0].replace(/`/g, '');
      const dataType = tokens[1];
      const isPk = upper.includes('PRIMARY KEY');
      const isNullable = !upper.includes('NOT NULL');

      return { columnName, dataType, isPk, isNullable };
    })
    .filter(c => c !== null);

  return { tableName, columns };
};

// Parser to extract table name, columns and values from an INSERT query
const parseInsertQuery = (sql) => {
  const match = sql.match(/insert\s+into\s+([a-zA-Z0-9_`]+)\s*(?:\(([^)]+)\))?\s*values\s*\(([\s\S]+)\)/i);
  if (!match) return null;

  const tableName = match[1].replace(/`/g, '').trim();
  const columnsStr = match[2] || '';
  const valuesStr = match[3];

  const columns = columnsStr.split(',').map(c => c.trim().replace(/`/g, '')).filter(Boolean);

  const values = [];
  let currentVal = '';
  let insideQuote = false;
  let quoteChar = '';
  
  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];
    if ((char === "'" || char === '"' || char === '`') && (i === 0 || valuesStr[i-1] !== '\\')) {
      if (!insideQuote) {
        insideQuote = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        insideQuote = false;
      }
    }
    
    if (char === ',' && !insideQuote) {
      values.push(currentVal.trim().replace(/^['"`]|['"`]$/g, ''));
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  if (currentVal.trim()) {
    values.push(currentVal.trim().replace(/^['"`]|['"`]$/g, ''));
  }

  const rowData = {};
  if (columns.length > 0) {
    columns.forEach((col, idx) => {
      rowData[col] = values[idx] || 'NULL';
    });
  } else {
    values.forEach((val, idx) => {
      rowData[`col_${idx + 1}`] = val;
    });
  }

  return { tableName, rowData, columns, rawValues: values };
};

// Parser to get table name from SELECT statement
const parseSelectTableName = (sql) => {
  const trimmed = sql.trim().toLowerCase();
  if (!trimmed.startsWith('select')) return null;
  const match = sql.match(/from\s+([a-zA-Z0-9_`]+)/i);
  return match ? match[1].replace(/`/g, '').trim() : null;
};

// Parser to get UPDATE schema fields
const parseUpdateQuery = (sql) => {
  const match = sql.match(/update\s+([a-zA-Z0-9_`]+)\s+set\s+([\s\S]+?)(?:\s+where\s+([\s\S]+))?$/i);
  if (!match) return null;

  const tableName = match[1].replace(/`/g, '').trim();
  const setClause = match[2].trim();
  const whereClause = match[3] ? match[3].trim() : '';

  const updates = [];
  const setParts = setClause.split(',');
  setParts.forEach(part => {
    const eqIdx = part.indexOf('=');
    if (eqIdx !== -1) {
      const col = part.substring(0, eqIdx).trim().replace(/`/g, '');
      const val = part.substring(eqIdx + 1).trim().replace(/^['"`]|['"`]$/g, '').replace(/;$/, '');
      updates.push({ column: col, newValue: val });
    }
  });

  return { tableName, updates, rawWhere: whereClause.replace(/;$/, '') };
};

// Parser to get DELETE schema fields
const parseDeleteQuery = (sql) => {
  const match = sql.match(/delete\s+from\s+([a-zA-Z0-9_`]+)(?:\s+where\s+([\s\S]+))?$/i);
  if (!match) return null;

  const tableName = match[1].replace(/`/g, '').trim();
  const whereClause = match[2] ? match[2].trim() : '';

  return { tableName, rawWhere: whereClause.replace(/;$/, '') };
};

// Parser to extract JOIN query info (tables, on-condition, join type)
const parseJoinQuery = (sql) => {
  // Match: SELECT ... FROM tableA [INNER|LEFT|RIGHT] JOIN tableB ON condition
  const joinMatch = sql.match(
    /select\s+([\s\S]+?)\s+from\s+([a-zA-Z0-9_`]+)(?:\s+(?:as\s+)?([a-zA-Z0-9_]+))?\s+(inner\s+join|left\s+join|right\s+join|join)\s+([a-zA-Z0-9_`]+)(?:\s+(?:as\s+)?([a-zA-Z0-9_]+))?\s+on\s+([\s\S]+?)(?:\s+where\s+[\s\S]+?)?(?:\s+order\s+by\s+[\s\S]+?)?(?:\s+limit\s+\d+)?\s*;?\s*$/i
  );
  if (!joinMatch) return null;

  const selectCols = joinMatch[1].trim();
  const leftTable = joinMatch[2].replace(/`/g, '').trim();
  const leftAlias = joinMatch[3] || leftTable;
  const joinType = joinMatch[4].replace(/\s+/g, ' ').toUpperCase();
  const rightTable = joinMatch[5].replace(/`/g, '').trim();
  const rightAlias = joinMatch[6] || rightTable;
  const onClause = joinMatch[7].trim().replace(/;$/, '');

  // Parse ON condition to find matching column pairs
  // e.g. "student.department_id = department.id" or "s.department_id = d.id"
  const condMatch = onClause.match(
    /([a-zA-Z0-9_`]+)\.([a-zA-Z0-9_`]+)\s*=\s*([a-zA-Z0-9_`]+)\.([a-zA-Z0-9_`]+)/i
  );
  
  let leftCol = null;
  let rightCol = null;
  if (condMatch) {
    const refA = condMatch[1].replace(/`/g, '');
    const colA = condMatch[2].replace(/`/g, '');
    const refB = condMatch[3].replace(/`/g, '');
    const colB = condMatch[4].replace(/`/g, '');

    // Determine which side refers to which table
    if (refA === leftTable || refA === leftAlias) {
      leftCol = colA;
      rightCol = colB;
    } else {
      leftCol = colB;
      rightCol = colA;
    }
  }

  return {
    selectCols,
    leftTable,
    leftAlias,
    rightTable,
    rightAlias,
    joinType,
    onClause,
    leftCol,
    rightCol
  };
};

// Parser to detect GROUP BY queries and extract grouping column + aggregates
const parseGroupByQuery = (sql) => {
  const trimmed = sql.trim();
  if (!/\bgroup\s+by\b/i.test(trimmed)) return null;

  // Extract: SELECT <selectList> FROM <table> ... GROUP BY <groupCol>
  const fromMatch = trimmed.match(/from\s+([a-zA-Z0-9_`]+)/i);
  const groupByMatch = trimmed.match(/group\s+by\s+([a-zA-Z0-9_`.]+)/i);
  if (!fromMatch || !groupByMatch) return null;

  const tableName = fromMatch[1].replace(/`/g, '').trim();
  // groupCol could be "table.col" or just "col"
  const groupColRaw = groupByMatch[1].replace(/`/g, '').trim();
  const groupCol = groupColRaw.includes('.') ? groupColRaw.split('.').pop() : groupColRaw;

  // Detect aggregate functions in the SELECT clause
  const selectPart = trimmed.match(/select\s+([\s\S]+?)\s+from/i);
  const aggregates = [];
  if (selectPart) {
    const selectStr = selectPart[1];
    const aggRegex = /(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*([^)]+)\s*\)/gi;
    let aggMatch;
    while ((aggMatch = aggRegex.exec(selectStr)) !== null) {
      aggregates.push({
        fn: aggMatch[1].toUpperCase(),
        column: aggMatch[2].replace(/`/g, '').trim()
      });
    }
  }

  return { tableName, groupCol, aggregates };
};

// Parser to detect ORDER BY queries and extract sorting column + direction
const parseOrderByQuery = (sql) => {
  const trimmed = sql.trim();
  if (!/\border\s+by\b/i.test(trimmed)) return null;

  // Extract table name from FROM table
  const fromMatch = trimmed.match(/from\s+([a-zA-Z0-9_`]+)/i);
  if (!fromMatch) return null;
  const tableName = fromMatch[1].replace(/`/g, '').trim();

  // Extract ORDER BY column and direction
  const orderMatch = trimmed.match(/order\s+by\s+([a-zA-Z0-9_`.]+)(?:\s+(asc|desc))?/i);
  if (!orderMatch) return null;

  const sortColRaw = orderMatch[1].replace(/`/g, '').trim();
  const sortCol = sortColRaw.includes('.') ? sortColRaw.split('.').pop() : sortColRaw;
  const direction = (orderMatch[2] || 'asc').toLowerCase();

  return { tableName, sortCol, direction };
};

// Parser/classifier for SQL query failures to generate beautiful animated insights
const parseSqlError = (sql, rawError) => {
  const err = rawError || '';
  let category = 'Syntax Error';
  let keyword = '';
  let explanation = '';
  let fixSuggestion = '';

  // 1. Table Not Found
  if (/doesn't exist/i.test(err) || /table .*not found/i.test(err) || /unknown table/i.test(err) || /relation .* does not exist/i.test(err)) {
    category = 'Table Not Found';
    explanation = 'The SQL engine attempted to query or modify a table that does not exist in the database schema.';
    fixSuggestion = 'Check your table spelling, ensure you are referencing the correct schema, or verify the active tables listed in the Database Viewer tab.';
    
    // Heuristic: Extract table name
    const match = err.match(/Table\s+'[^.]+\.([^']+)'/i) || err.match(/Table\s+'([^']+)'/i) || err.match(/table\s+['`"]?([a-zA-Z0-9_]+)['`"]?/i);
    if (match) {
      keyword = match[1];
    }
    if (!keyword) {
      const selectMatch = sql.match(/from\s+([a-zA-Z0-9_`]+)/i) || sql.match(/into\s+([a-zA-Z0-9_`]+)/i) || sql.match(/update\s+([a-zA-Z0-9_`]+)/i) || sql.match(/delete\s+from\s+([a-zA-Z0-9_`]+)/i);
      if (selectMatch) keyword = selectMatch[1].replace(/`/g, '');
    }
  }
  // 2. Column Not Found
  else if (/unknown column/i.test(err) || /column .*not found/i.test(err) || /no such column/i.test(err)) {
    category = 'Column Not Found';
    explanation = 'The query references a column name that is not defined on the targeted table(s).';
    fixSuggestion = 'Verify the table columns in the Database Viewer. Ensure there are no typos, and if joining tables, check that you prefixed the column with the correct table name/alias.';
    
    // Heuristic: Extract column name
    const match = err.match(/Unknown column\s+'([^']+)'/i) || err.match(/column\s+['`"]?([a-zA-Z0-9_]+)['`"]?/i);
    if (match) {
      keyword = match[1];
    }
  }
  // 3. Duplicate Primary Key
  else if (/duplicate entry/i.test(err) || /primary key violation/i.test(err) || /unique constraint/i.test(err) || /PRIMARY/i.test(err) && /duplicate/i.test(err)) {
    category = 'Duplicate Primary Key';
    explanation = 'A uniqueness constraint was violated because the primary key (or another unique index field) value you provided already exists in the table.';
    fixSuggestion = 'Choose a different value for the unique/primary key column, or check existing entries. If the table has an AUTO_INCREMENT primary key, omit it from your INSERT query so the engine assigns it automatically.';
    
    // Heuristic: Extract duplicate key value
    const match = err.match(/Duplicate entry\s+'([^']+)'/i);
    if (match) {
      keyword = match[1];
    } else {
      keyword = 'PRIMARY';
    }
  }
  // 4. Foreign Key Violation
  else if (/foreign key constraint fails/i.test(err) || /fk violation/i.test(err) || /referential integrity/i.test(err) || /a foreign key constraint/i.test(err)) {
    category = 'Foreign Key Violation';
    explanation = 'Referential integrity checks failed. You are attempting to insert/update a foreign key field referencing a non-existent parent row, or deleting a parent row that still has dependent child rows.';
    fixSuggestion = 'Ensure the corresponding row exists in the parent reference table first before writing, or delete/nullify child referencing rows first before deleting a parent row.';
    
    // Heuristic: Extract violating constraint or column name
    const match = err.match(/FOREIGN KEY\s+\(`([^`]+)`\)/i) || err.match(/constraint/i);
    if (match) {
      keyword = match[1];
    } else {
      const refMatch = sql.match(/references\s+([a-zA-Z0-9_`]+)/i);
      if (refMatch) keyword = refMatch[1].replace(/`/g, '');
    }
  }
  // 5. NOT NULL Violation
  else if (/cannot be null/i.test(err) || /not-null/i.test(err) || /null not allowed/i.test(err) || /null\b/i.test(err) && /not\s+null/i.test(err)) {
    category = 'NOT NULL Violation';
    explanation = 'The targeted column is defined as NOT NULL in the table schema, but your query sets it to NULL or omits a value during row creation.';
    fixSuggestion = 'Provide a non-null, valid value for this field in your values list/set clause, or update the table structure to allow nullable columns if required.';
    
    // Heuristic: Extract column name
    const match = err.match(/Column\s+'([^']+)'\s+cannot\s+be\s+null/i) || err.match(/Column\s+'([^']+)'/i);
    if (match) {
      keyword = match[1];
    }
  }
  // 6. Data Type Mismatch
  else if (/incorrect integer value/i.test(err) || /data truncation/i.test(err) || /incorrect\s+\w+\s+value/i.test(err) || /type mismatch/i.test(err) || /invalid input syntax/i.test(err)) {
    category = 'Data Type Mismatch';
    explanation = 'The value provided is incompatible with the data type defined for this column (e.g. inserting alphabetic text into an integer column).';
    fixSuggestion = 'Check column structures in the Database Viewer. Ensure you wrap strings/dates in single quotes, remove quotes from numeric values, and match valid formats (like YYYY-MM-DD for date fields).';
    
    // Heuristic: Extract column or incorrect value
    const valMatch = err.match(/value:\s+'([^']+)'/i);
    const colMatch = err.match(/column\s+'([^']+)'/i);
    if (valMatch) {
      keyword = valMatch[1];
    } else if (colMatch) {
      keyword = colMatch[1];
    }
  }
  // 7. Syntax Error
  else {
    category = 'Syntax Error';
    explanation = 'The query parser failed to compile the statement because it violates SQL grammar syntax rules.';
    fixSuggestion = 'Review SQL syntax principles. Verify there are no missing commas between SELECT fields, mismatched open/close parentheses, or spelling errors in primary SQL keywords.';
    
    // Heuristic: Extract the syntax error position word from MySQL driver
    const match = err.match(/near\s+'([^']+)'/i);
    if (match) {
      const nearText = match[1];
      const firstWord = nearText.trim().split(/[\s,()]+/)[0];
      keyword = firstWord.replace(/[^a-zA-Z0-9_]/g, '');
    }
    if (!keyword) {
      const commonTypos = /\b(SELECTT|FRM|WHER|UPDAT|DELET|INSER|INTTO|VALUS|CREAT|TABL|COLUM)\b/i;
      const typoMatch = sql.match(commonTypos);
      if (typoMatch) {
        keyword = typoMatch[1];
      }
    }
  }

  // Sanitize the keyword
  if (keyword) {
    keyword = keyword.trim().replace(/[`'"\(\)]/g, '');
  }

  return { category, keyword, explanation, fixSuggestion };
};

const highlightFaultyKeyword = (sql, keyword) => {
  if (!keyword || !sql) return highlightSQL(sql);

  // Escape special regex characters in keyword
  const escapedKeyword = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

  // Match the word inside the query
  let regex;
  try {
    regex = new RegExp(`\\b(${escapedKeyword})\\b`, 'gi');
  } catch (e) {
    regex = new RegExp(escapedKeyword, 'gi');
  }

  // If it doesn't match boundaries, fall back to literal
  if (!regex.test(sql)) {
    regex = new RegExp(escapedKeyword, 'gi');
  }

  regex.lastIndex = 0;

  // Mask the word with a unique placeholder
  const placeholder = `___FAULTY_KEYWORD_${keyword}___`;
  const sqlWithPlaceholder = sql.replace(regex, placeholder);

  // Parse SQL highlights
  let html = highlightSQL(sqlWithPlaceholder);

  // Replace placeholder with a neon glowing red wavy underlined span
  const escapedPlaceholder = placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const replaceRegex = new RegExp(escapedPlaceholder, 'g');

  html = html.replace(
    replaceRegex,
    `<span class="bg-red-500/20 text-red-400 border border-red-500/40 px-1.5 py-0.5 rounded font-black underline decoration-wavy decoration-red-500 shadow-[0_0_12px_rgba(239,68,68,0.3)] animate-pulse">${keyword}</span>`
  );

  return html;
};

// Color palette for GROUP BY groups
const GROUP_COLORS = [
  { bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', text: 'text-cyan-400', dot: 'bg-cyan-400', glow: 'shadow-cyan-500/20', accent: '#22d3ee' },
  { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-400', dot: 'bg-purple-400', glow: 'shadow-purple-500/20', accent: '#a855f7' },
  { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-400', glow: 'shadow-amber-500/20', accent: '#f59e0b' },
  { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400', glow: 'shadow-emerald-500/20', accent: '#10b981' },
  { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-400', dot: 'bg-rose-400', glow: 'shadow-rose-500/20', accent: '#f43f5e' },
  { bg: 'bg-sky-500/15', border: 'border-sky-500/30', text: 'text-sky-400', dot: 'bg-sky-400', glow: 'shadow-sky-500/20', accent: '#0ea5e9' },
  { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-400', glow: 'shadow-orange-500/20', accent: '#f97316' },
  { bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', text: 'text-indigo-400', dot: 'bg-indigo-400', glow: 'shadow-indigo-500/20', accent: '#6366f1' },
];

// Check if a row matches comparison structures
const checkRowMatch = (row, matchingRows) => {
  if (!matchingRows || matchingRows.length === 0) return false;
  
  if (row.id !== undefined && row.id !== null) {
    return matchingRows.some(m => m.id === row.id);
  }
  
  if (row.code !== undefined && row.code !== null) {
    return matchingRows.some(m => m.code === row.code);
  }
  if (row.rollNumber !== undefined && row.rollNumber !== null) {
    return matchingRows.some(m => m.rollNumber === row.rollNumber);
  }

  const rowStr = JSON.stringify(row);
  return matchingRows.some(m => JSON.stringify(m) === rowStr);
};

// SQL Templates for presets
const SQL_PRESETS = [
  {
    name: 'Sort Students by Study Year (DESC)',
    query: `SELECT id, name, email, roll_number, year_of_study\nFROM student\nORDER BY year_of_study DESC;`
  },
  {
    name: 'Group By Department',
    query: `SELECT department_id, COUNT(*) AS student_count, AVG(year_of_study) AS avg_year, SUM(year_of_study) AS total_years\nFROM student\nGROUP BY department_id;`
  },
  {
    name: 'Join Students ↔ Departments',
    query: `SELECT student.name, student.roll_number, student.year_of_study, department.name, department.code\nFROM student\nJOIN department ON student.department_id = department.id;`
  },
  {
    name: 'Insert Sample Student',
    query: `INSERT INTO student (name, email, roll_number, year_of_study, department_id, created_at, updated_at)\nVALUES ('Rahul Sen', 'rahul.sen@university.edu', 'CSE2024009', 2, 1, NOW(), NOW());`
  },
  {
    name: 'Delete Sample Student',
    query: `DELETE FROM student WHERE name = 'Rahul Sen';`
  },
  {
    name: 'Update Student Study Year',
    query: `UPDATE student SET year_of_study = 3 WHERE id = 1;`
  },
  {
    name: 'Select Students in Year 2',
    query: `SELECT id, name, email, roll_number, year_of_study\nFROM student\nWHERE year_of_study = 2\nORDER BY name ASC;`
  }
];

export default function SqlEditor() {
  const [query, setQuery] = useState(SQL_PRESETS[0].query);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  
  // Animation states for CREATE TABLE
  const [showAnimation, setShowAnimation] = useState(false);
  const [animationData, setAnimationData] = useState(null);
  const [animationStep, setAnimationStep] = useState(0); 
  const [visibleColumns, setVisibleColumns] = useState([]);

  // Animation states for INSERT INTO
  const [showInsertAnimation, setShowInsertAnimation] = useState(false);
  const [insertAnimData, setInsertAnimData] = useState(null);
  const [insertAnimStep, setInsertAnimStep] = useState(0); 
  const [existingTableRows, setExistingTableRows] = useState([]);
  const [existingTableColumns, setExistingTableColumns] = useState([]);

  // Animation states for SELECT
  const [showSelectAnimation, setShowSelectAnimation] = useState(false);
  const [selectAnimData, setSelectAnimData] = useState(null);
  const [selectScanIndex, setSelectScanIndex] = useState(-1);
  const [scanMatchedIds, setScanMatchedIds] = useState(new Set());
  const [selectScanComplete, setSelectScanComplete] = useState(false);

  // Animation states for UPDATE
  const [showUpdateAnimation, setShowUpdateAnimation] = useState(false);
  const [updateAnimData, setUpdateAnimData] = useState(null);
  const [updateAnimStep, setUpdateAnimStep] = useState(0); 

  // Animation states for DELETE
  const [showDeleteAnimation, setShowDeleteAnimation] = useState(false);
  const [deleteAnimData, setDeleteAnimData] = useState(null);
  const [deleteAnimStep, setDeleteAnimStep] = useState(0); // 0: turn red, 1: fade out, 2: collapse/complete

  // Animation states for JOIN
  const [showJoinAnimation, setShowJoinAnimation] = useState(false);
  const [joinAnimData, setJoinAnimData] = useState(null);
  const [joinAnimStep, setJoinAnimStep] = useState(0); // 0: show tables, 1: draw lines, 2: show result
  const [joinVisibleLines, setJoinVisibleLines] = useState(0);
  const joinContainerRef = useRef(null);

  // Animation states for GROUP BY
  const [showGroupByAnimation, setShowGroupByAnimation] = useState(false);
  const [groupByAnimData, setGroupByAnimData] = useState(null);
  const [groupByAnimStep, setGroupByAnimStep] = useState(0); // 0: show raw rows, 1: color-group them, 2: show aggregate cards
  const [groupByVisibleGroups, setGroupByVisibleGroups] = useState(0);
  const [groupByVisibleCards, setGroupByVisibleCards] = useState(0);

  // Animation states for ORDER BY (Sorting)
  const [showSortAnimation, setShowSortAnimation] = useState(false);
  const [sortAnimData, setSortAnimData] = useState(null);
  const [sortAnimStep, setSortAnimStep] = useState(0); // 0: show unsorted, 1: sorting transition, 2: sorted confirmation

  // Animation states for SQL Error Debugger
  const [showErrorAnimation, setShowErrorAnimation] = useState(false);
  const [errorAnimData, setErrorAnimData] = useState(null);
  const [errorAnimStep, setErrorAnimStep] = useState(0); // 0: Parser, 1: Error Detection, 2: Highlight & Explanation

  const textareaRef = useRef(null);
  const backdropRef = useRef(null);

  // Sync scroll
  const handleScroll = () => {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('sql_query_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse history:', e);
      }
    }
  }, []);

  const saveToHistory = (queryString) => {
    const trimmed = queryString.trim();
    if (!trimmed) return;
    const filtered = history.filter(q => q !== trimmed);
    const updated = [trimmed, ...filtered].slice(0, 20);
    setHistory(updated);
    localStorage.setItem('sql_query_history', JSON.stringify(updated));
  };

  // Run the CREATE TABLE animation pipeline
  const runCreateTableAnimation = (parsed) => {
    setAnimationData(parsed);
    setShowAnimation(true);
    setAnimationStep(0);
    setVisibleColumns([]);

    setTimeout(() => {
      setAnimationStep(1);
      setTimeout(() => {
        setAnimationStep(2);
        revealColumns(parsed.columns);
      }, 1500);
    }, 1500);
  };

  // Reveal columns one by one
  const revealColumns = (columnsList) => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < columnsList.length) {
        setVisibleColumns(prev => [...prev, columnsList[index]]);
        index++;
      } else {
        clearInterval(interval);
        setAnimationStep(3);
      }
    }, 600);
  };

  // Run INSERT animation pipeline
  const runInsertAnimation = async (parsed, execTime, affectedRows) => {
    setInsertAnimStep(0);
    setShowInsertAnimation(true);
    
    try {
      const response = await axiosClient.get(`/metadata/tables/${parsed.tableName}`);
      setExistingTableRows(response.data.rows || []);
      setExistingTableColumns(response.data.columns.map(c => c.columnName));
    } catch (e) {
      setExistingTableRows([]);
      setExistingTableColumns(parsed.columns.length > 0 ? parsed.columns : Object.keys(parsed.rowData));
    }

    setInsertAnimData({
      tableName: parsed.tableName,
      rowData: parsed.rowData,
      execTime: execTime,
      affectedRows: affectedRows,
      columns: parsed.columns
    });

    setTimeout(() => {
      setInsertAnimStep(1);
      setTimeout(() => {
        setInsertAnimStep(2);
      }, 1500);
    }, 1000);
  };

  // Run SELECT scan animation pipeline
  const runSelectAnimation = async (tableName, matchingRows, execTime) => {
    setSelectScanIndex(-1);
    setScanMatchedIds(new Set());
    setSelectScanComplete(false);
    setShowSelectAnimation(true);

    let allRows = [];
    let columns = [];
    
    try {
      const response = await axiosClient.get(`/metadata/tables/${tableName}`);
      allRows = response.data.rows || [];
      columns = response.data.columns.map(c => c.columnName);
    } catch (e) {
      allRows = matchingRows;
      columns = matchingRows.length > 0 ? Object.keys(matchingRows[0]) : [];
    }

    setSelectAnimData({
      tableName,
      matchingRows,
      allRows,
      columns,
      execTime
    });

    setTimeout(() => {
      let currentIdx = 0;
      setSelectScanIndex(0);

      const scanTimer = setInterval(() => {
        if (currentIdx < allRows.length) {
          const currentRow = allRows[currentIdx];
          const isMatch = checkRowMatch(currentRow, matchingRows);
          
          if (isMatch) {
            setScanMatchedIds(prev => {
              const updated = new Set(prev);
              updated.add(currentIdx);
              return updated;
            });
          }
          
          currentIdx++;
          setSelectScanIndex(currentIdx);
        } else {
          clearInterval(scanTimer);
          setSelectScanComplete(true);
        }
      }, 300);
    }, 1000);
  };

  // Run UPDATE animation pipeline
  const runUpdateAnimation = async (parsed, execTime, affectedRows) => {
    setUpdateAnimStep(0);
    setShowUpdateAnimation(true);

    let oldRow = null;
    let columns = [];

    try {
      const metadataRes = await axiosClient.get(`/metadata/tables/${parsed.tableName}`);
      columns = metadataRes.data.columns.map(c => c.columnName);
      
      const selectQuery = `SELECT * FROM ${parsed.tableName} ${parsed.rawWhere ? 'WHERE ' + parsed.rawWhere : ''}`;
      const preRes = await axiosClient.post('/sql/execute', { query: selectQuery });
      if (preRes.data.success && preRes.data.data.length > 0) {
        oldRow = preRes.data.data[0];
      }
    } catch (e) {
      console.error('Failed to pre-fetch old row:', e);
    }

    setUpdateAnimData({
      tableName: parsed.tableName,
      updates: parsed.updates,
      oldRow: oldRow || {},
      columns: columns.length > 0 ? columns : (oldRow ? Object.keys(oldRow) : []),
      execTime,
      affectedRows
    });

    setTimeout(() => {
      setUpdateAnimStep(1);
      setTimeout(() => {
        setUpdateAnimStep(2);
      }, 1500);
    }, 1500);
  };

  // Run DELETE animation pipeline
  const runDeleteAnimation = async (parsed, execTime, affectedRows, targetsToDelete) => {
    setDeleteAnimStep(0);
    setShowDeleteAnimation(true);

    let allRows = [];
    let columns = [];

    // Fetch the table schema structure & current records to show what's being removed
    try {
      const response = await axiosClient.get(`/metadata/tables/${parsed.tableName}`);
      columns = response.data.columns.map(c => c.columnName);
      
      // We union the deleted targets with other rows to show context
      const allFetched = response.data.rows || [];
      // Combine list to make sure deleted ones are visible in grid
      const otherRows = allFetched.filter(r => !checkRowMatch(r, targetsToDelete));
      allRows = [...targetsToDelete, ...otherRows.slice(0, 3)]; // Show deleted rows + 3 neighbors
    } catch (e) {
      allRows = targetsToDelete;
      columns = targetsToDelete.length > 0 ? Object.keys(targetsToDelete[0]) : [];
    }

    setDeleteAnimData({
      tableName: parsed.tableName,
      allRows,
      deletedRows: targetsToDelete,
      columns,
      execTime,
      affectedRows
    });

    // Step 0 -> Step 1 (Fade out rows)
    setTimeout(() => {
      setDeleteAnimStep(1);

      // Step 1 -> Step 2 (Remove/Collapse rows from visual layout)
      setTimeout(() => {
        setDeleteAnimStep(2);
      }, 1500);
    }, 1500);
  };

  // Run JOIN animation pipeline
  const runJoinAnimation = async (parsed, resultData, resultColumns, execTime) => {
    setJoinAnimStep(0);
    setJoinVisibleLines(0);
    setShowJoinAnimation(true);

    let leftRows = [];
    let leftCols = [];
    let rightRows = [];
    let rightCols = [];

    // Fetch data from both tables
    try {
      const [leftRes, rightRes] = await Promise.all([
        axiosClient.get(`/metadata/tables/${parsed.leftTable}`),
        axiosClient.get(`/metadata/tables/${parsed.rightTable}`)
      ]);
      leftRows = (leftRes.data.rows || []).slice(0, 12);
      leftCols = leftRes.data.columns.map(c => c.columnName);
      rightRows = (rightRes.data.rows || []).slice(0, 12);
      rightCols = rightRes.data.columns.map(c => c.columnName);
    } catch (e) {
      console.error('Failed to fetch table data for JOIN animation:', e);
    }

    // Build matching pairs: which left row index matches which right row index
    const matchPairs = [];
    if (parsed.leftCol && parsed.rightCol) {
      leftRows.forEach((lRow, lIdx) => {
        const lVal = lRow[parsed.leftCol];
        rightRows.forEach((rRow, rIdx) => {
          const rVal = rRow[parsed.rightCol];
          // Compare as strings to handle type mismatches (e.g., number vs string)
          if (lVal != null && rVal != null && String(lVal) === String(rVal)) {
            matchPairs.push({ leftIdx: lIdx, rightIdx: rIdx });
          }
        });
      });
    }

    // Pick display columns: max 4 per side for readability
    const displayLeftCols = leftCols.slice(0, 4);
    const displayRightCols = rightCols.slice(0, 4);

    setJoinAnimData({
      ...parsed,
      leftRows,
      leftCols: displayLeftCols,
      rightRows,
      rightCols: displayRightCols,
      matchPairs,
      resultData: resultData.slice(0, 15),
      resultColumns: resultColumns,
      execTime,
      totalMatches: resultData.length
    });

    // Step 0: Show the two tables (already shown)
    // After 1.5s → Step 1: Animate connection lines one by one
    setTimeout(() => {
      setJoinAnimStep(1);
      let lineIdx = 0;
      const lineTimer = setInterval(() => {
        if (lineIdx < matchPairs.length) {
          lineIdx++;
          setJoinVisibleLines(lineIdx);
        } else {
          clearInterval(lineTimer);
          // After all lines drawn, wait 1s → Step 2: Show result table
          setTimeout(() => {
            setJoinAnimStep(2);
          }, 1000);
        }
      }, 250);
    }, 1500);
  };

  // Run GROUP BY animation pipeline
  const runGroupByAnimation = async (parsed, resultData, resultColumns, execTime) => {
    setGroupByAnimStep(0);
    setGroupByVisibleGroups(0);
    setGroupByVisibleCards(0);
    setShowGroupByAnimation(true);

    let allRows = [];
    let tableCols = [];

    // Fetch raw table data to show ungrouped rows
    try {
      const response = await axiosClient.get(`/metadata/tables/${parsed.tableName}`);
      allRows = (response.data.rows || []).slice(0, 30);
      tableCols = response.data.columns.map(c => c.columnName);
    } catch (e) {
      console.error('Failed to fetch table data for GROUP BY animation:', e);
    }

    // Build groups from raw rows
    const groupMap = new Map();
    allRows.forEach(row => {
      const key = '' + (row[parsed.groupCol] ?? 'NULL');
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key).push(row);
    });

    const groups = [];
    let colorIdx = 0;
    for (const [key, rows] of groupMap) {
      const color = GROUP_COLORS[colorIdx % GROUP_COLORS.length];
      
      // Compute aggregates on numeric columns
      const numericCols = tableCols.filter(col => {
        return rows.some(r => typeof r[col] === 'number' || (!isNaN(Number(r[col])) && r[col] !== '' && r[col] !== null));
      });

      const aggCards = [];
      // COUNT always present
      aggCards.push({ fn: 'COUNT', column: '*', value: rows.length });

      // SUM and AVG for numeric columns that aren't the group column itself
      numericCols.forEach(nc => {
        if (nc === parsed.groupCol) return;
        if (nc === 'id' || nc.endsWith('_id') || nc === 'created_at' || nc === 'updated_at') return;
        const nums = rows.map(r => Number(r[nc])).filter(n => !isNaN(n));
        if (nums.length > 0) {
          const sum = nums.reduce((a, b) => a + b, 0);
          aggCards.push({ fn: 'SUM', column: nc, value: sum });
          aggCards.push({ fn: 'AVG', column: nc, value: +(sum / nums.length).toFixed(2) });
        }
      });

      groups.push({
        key,
        rows,
        color,
        aggCards
      });
      colorIdx++;
    }

    // Pick display columns (max 5 for readability)
    const displayCols = tableCols.filter(c => c !== 'created_at' && c !== 'updated_at').slice(0, 5);

    setGroupByAnimData({
      ...parsed,
      allRows,
      tableCols: displayCols,
      groups,
      resultData,
      resultColumns,
      execTime,
      totalGroups: groups.length
    });

    // Step 0: Show raw rows (immediate)
    // After 1.5s → Step 1: Color-code groups one by one
    setTimeout(() => {
      setGroupByAnimStep(1);
      let gIdx = 0;
      const groupTimer = setInterval(() => {
        if (gIdx < groups.length) {
          gIdx++;
          setGroupByVisibleGroups(gIdx);
        } else {
          clearInterval(groupTimer);
          // After all groups colored, wait 1s → Step 2: Show aggregate cards
          setTimeout(() => {
            setGroupByAnimStep(2);
            let cIdx = 0;
            // Count total cards across all groups
            const totalCards = groups.reduce((sum, g) => sum + g.aggCards.length, 0);
            const cardTimer = setInterval(() => {
              if (cIdx < totalCards) {
                cIdx++;
                setGroupByVisibleCards(cIdx);
              } else {
                clearInterval(cardTimer);
              }
            }, 150);
          }, 1000);
        }
      }, 400);
    }, 1500);
  };

  // Run ORDER BY sorting animation pipeline
  const runSortAnimation = async (parsed, sortedRows, resultColumns, execTime) => {
    setSortAnimStep(0);
    setShowSortAnimation(true);

    let rawRows = [];
    let tableCols = [];

    // Fetch the table records in their original state (unsorted)
    try {
      const response = await axiosClient.get(`/metadata/tables/${parsed.tableName}`);
      // Limit to first 12 for clean overlay visualization
      rawRows = (response.data.rows || []).slice(0, 12);
      tableCols = response.data.columns.map(c => c.columnName);
    } catch (e) {
      console.error('Failed to fetch data for ORDER BY animation:', e);
      rawRows = sortedRows.slice(0, 12);
      tableCols = resultColumns;
    }

    // Determine correct target indices. Match rows by ID, Roll Number, or stringified content
    // We want to map each index in rawRows to its index in the sorted list
    const mappedRows = rawRows.map((row, idx) => {
      // Find where this row ends up in sortedRows
      let targetIdx = sortedRows.findIndex(sRow => {
        if (row.id !== undefined && sRow.id !== undefined) return row.id === sRow.id;
        if (row.rollNumber !== undefined && sRow.rollNumber !== undefined) return row.rollNumber === sRow.rollNumber;
        return JSON.stringify(row) === JSON.stringify(sRow);
      });
      // Fallback if not found in sorted slice
      if (targetIdx === -1) targetIdx = idx;
      return {
        row,
        originalIdx: idx,
        targetIdx
      };
    });

    const displayCols = tableCols.filter(c => c !== 'created_at' && c !== 'updated_at').slice(0, 5);

    setSortAnimData({
      ...parsed,
      mappedRows,
      tableCols: displayCols,
      sortedRows: sortedRows.slice(0, 12),
      execTime,
      totalRows: sortedRows.length
    });

    // Step 0: Display unsorted list
    // After 1.5s -> Step 1: Slide rows vertically into sorted order
    setTimeout(() => {
      setSortAnimStep(1);

      // After 2.5s -> Step 2: Show final confirmation and result grid
      setTimeout(() => {
        setSortAnimStep(2);
      }, 2500);
    }, 1500);
  };

  const runErrorAnimation = (sqlQuery, rawError) => {
    const parsed = parseSqlError(sqlQuery, rawError);
    setErrorAnimData({
      query: sqlQuery,
      rawError,
      ...parsed
    });
    setErrorAnimStep(0);
    setShowErrorAnimation(true);

    setTimeout(() => {
      setErrorAnimStep(1);
      setTimeout(() => {
        setErrorAnimStep(2);
      }, 1200);
    }, 1200);
  };

  const handleExecute = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);

    const trimmedQuery = query.trim().toLowerCase();
    let preParsedUpdate = null;
    let preParsedDelete = null;
    
    if (trimmedQuery.startsWith('update')) {
      preParsedUpdate = parseUpdateQuery(query);
    }
    if (trimmedQuery.startsWith('delete')) {
      preParsedDelete = parseDeleteQuery(query);
    }
    
    try {
      // 1. Pre-fetch old row state for UPDATE queries
      let oldValuesFetched = null;
      if (preParsedUpdate) {
        try {
          const selectQuery = `SELECT * FROM ${preParsedUpdate.tableName} ${preParsedUpdate.rawWhere ? 'WHERE ' + preParsedUpdate.rawWhere : ''}`;
          const selectRes = await axiosClient.post('/sql/execute', { query: selectQuery });
          if (selectRes.data.success && selectRes.data.data.length > 0) {
            oldValuesFetched = selectRes.data.data[0];
          }
        } catch (e) {
          console.error("Silent pre-SELECT check failed:", e);
        }
      }

      // 2. Pre-fetch rows to delete for DELETE queries
      let deleteTargetsFetched = [];
      if (preParsedDelete) {
        try {
          const selectQuery = `SELECT * FROM ${preParsedDelete.tableName} ${preParsedDelete.rawWhere ? 'WHERE ' + preParsedDelete.rawWhere : ''}`;
          const selectRes = await axiosClient.post('/sql/execute', { query: selectQuery });
          if (selectRes.data.success) {
            deleteTargetsFetched = selectRes.data.data;
          }
        } catch (e) {
          console.error("Silent pre-DELETE fetch failed:", e);
        }
      }

      // Execute actual statement
      const response = await axiosClient.post('/sql/execute', { query });
      setResult(response.data);
      if (response.data.success) {
        saveToHistory(query);

        // 1. CREATE TABLE check
        if (trimmedQuery.startsWith('create') && trimmedQuery.includes('table')) {
          const parsed = parseCreateTable(query);
          if (parsed) {
            runCreateTableAnimation(parsed);
          }
        }
        
        // 2. INSERT INTO check
        if (trimmedQuery.startsWith('insert') && trimmedQuery.includes('into')) {
          const parsed = parseInsertQuery(query);
          if (parsed) {
            runInsertAnimation(parsed, response.data.executionTimeMs, response.data.affectedRows);
          }
        }

        // 3. GROUP BY check (must come before JOIN and plain SELECT)
        if (trimmedQuery.startsWith('select') && /\bgroup\s+by\b/i.test(query)) {
          const groupByParsed = parseGroupByQuery(query);
          if (groupByParsed) {
            runGroupByAnimation(groupByParsed, response.data.data, response.data.columns, response.data.executionTimeMs);
          }
        }
        // 3b. JOIN check
        else if (trimmedQuery.startsWith('select') && /\bjoin\b/i.test(query)) {
          const joinParsed = parseJoinQuery(query);
          if (joinParsed) {
            runJoinAnimation(joinParsed, response.data.data, response.data.columns, response.data.executionTimeMs);
          }
        }
        // 3c. ORDER BY check (must come before plain SELECT)
        else if (trimmedQuery.startsWith('select') && /\border\s+by\b/i.test(query)) {
          const orderParsed = parseOrderByQuery(query);
          if (orderParsed) {
            runSortAnimation(orderParsed, response.data.data, response.data.columns, response.data.executionTimeMs);
          }
        }
        // 3d. Plain SELECT check (non-JOIN, non-GROUP BY, non-ORDER BY)
        else if (trimmedQuery.startsWith('select')) {
          const tableName = parseSelectTableName(query);
          if (tableName && ['student', 'course', 'department'].includes(tableName)) {
            runSelectAnimation(tableName, response.data.data, response.data.executionTimeMs);
          }
        }

        // 4. UPDATE check
        if (preParsedUpdate) {
          preParsedUpdate.oldRow = oldValuesFetched;
          runUpdateAnimation(preParsedUpdate, response.data.executionTimeMs, response.data.affectedRows);
        }

        // 5. DELETE check
        if (preParsedDelete && deleteTargetsFetched.length > 0) {
          runDeleteAnimation(preParsedDelete, response.data.executionTimeMs, response.data.affectedRows, deleteTargetsFetched);
        }
      } else {
        runErrorAnimation(query, response.data.error);
      }
    } catch (err) {
      const rawError = err.response?.data?.error || err.message || 'Connection error';
      setResult({
        success: false,
        error: rawError
      });
      runErrorAnimation(query, rawError);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResult(null);
  };

  const handleExportCSV = () => {
    if (!result || !result.data || result.data.length === 0) return;
    const headers = result.columns;
    const csvRows = [headers.join(',')];

    for (const row of result.data) {
      const values = headers.map(header => {
        const val = row[header];
        const escaped = ('' + (val ?? '')).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `query_result_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-6 bg-surface-900">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* SQL Editor Area */}
        <div className="lg:col-span-3 space-y-6">
          
          <div className="animate-slide-up">
            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
              SQL <span className="gradient-text">Console</span>
            </h1>
            <p className="text-gray-400 text-sm">
              Execute raw SQL queries. SELECT, INSERT, UPDATE, DELETE, JOIN, GROUP BY, ORDER BY, and CREATE TABLE queries trigger beautiful animations!
            </p>
          </div>

          {/* SQL Editor Container */}
          <div className="glass-card overflow-hidden flex flex-col border-primary-500/20">
            <div className="bg-white/5 px-6 py-3 border-b border-white/10 flex justify-between items-center flex-wrap gap-2">
              <div className="flex gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/50" />
                <span className="w-3 h-3 rounded-full bg-amber-500/50" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/50" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleClear}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all"
                >
                  Clear
                </button>
                <button
                  onClick={handleExecute}
                  disabled={loading}
                  className="px-5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:from-primary-500 hover:to-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? 'Running...' : '⚡ Execute Query'}
                </button>
              </div>
            </div>

            <div className="relative h-64 font-mono text-sm leading-relaxed overflow-hidden bg-surface-950">
              <div
                ref={backdropRef}
                className="absolute inset-0 p-4 overflow-auto whitespace-pre-wrap break-all pointer-events-none text-gray-300"
                style={{ scrollbarWidth: 'none' }}
                dangerouslySetInnerHTML={{ __html: highlightSQL(query) + '\n' }}
              />
              <textarea
                ref={textareaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onScroll={handleScroll}
                placeholder="-- Write your SQL query here..."
                spellCheck="false"
                className="absolute inset-0 w-full h-full p-4 overflow-auto bg-transparent border-0 text-transparent caret-white resize-none focus:outline-none focus:ring-0 whitespace-pre-wrap break-all"
              />
            </div>
          </div>

          {/* Results Workspace */}
          {result && (
            <div className="glass-card overflow-hidden animate-slide-up">
              <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex justify-between items-center flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Query Results
                  </h3>
                  {result.success && result.type === 'SELECT' && (
                    <span className="text-[10px] text-gray-500">
                      Returned {result.rowCount} row(s)
                    </span>
                  )}
                </div>
                {result.success && result.type === 'SELECT' && result.data.length > 0 && (
                  <button
                    onClick={handleExportCSV}
                    className="px-3 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 text-xs font-semibold transition-all"
                  >
                    📥 Export CSV
                  </button>
                )}
              </div>

              <div className="p-6">
                {!result.success ? (
                  <div className="border border-red-500/30 bg-red-500/5 p-4 rounded-xl">
                    <div className="text-red-400 font-bold text-xs uppercase tracking-wider mb-1">
                      Error running query
                    </div>
                    <pre className="text-xs font-mono text-gray-400 whitespace-pre-wrap break-all">
                      {result.error}
                    </pre>
                  </div>
                ) : result.type === 'SELECT' ? (
                  result.data.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 text-xs">
                      Query returned 0 rows.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            {result.columns.map((col) => (
                              <th key={col} className="px-4 py-3 font-mono">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                          {result.data.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-white/5 transition-colors">
                              {result.columns.map((col) => (
                                <td key={col} className="px-4 py-3 font-mono">
                                  {row[col] === null ? (
                                    <span className="text-gray-600 italic">NULL</span>
                                  ) : typeof row[col] === 'object' ? (
                                    JSON.stringify(row[col])
                                  ) : (
                                    '' + row[col]
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  <div className="border border-emerald-500/30 bg-emerald-500/5 p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
                        Success
                      </div>
                      <div className="text-xs text-gray-300">
                        Query executed successfully. Affected row count: <strong className="text-emerald-400 font-mono">{result.affectedRows}</strong>
                      </div>
                    </div>
                    <div className="text-xs font-mono text-gray-500 text-right">
                      <div>Execution time: <strong className="text-purple-400">{result.executionTimeMs?.toFixed(2) || '—'} ms</strong></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Sidebar Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-xs font-bold text-primary-400 uppercase tracking-wider mb-4">
              Query Presets
            </h3>
            <div className="space-y-3">
              {SQL_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(preset.query);
                    setResult(null);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-xs font-semibold text-gray-300 group"
                >
                  <div className="group-hover:text-primary-400 transition-colors mb-1">
                    {preset.name}
                  </div>
                  <pre className="text-[10px] text-gray-500 font-mono truncate">
                    {preset.query.split('\n')[0]}
                  </pre>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                History
              </h3>
              {history.length > 0 && (
                <button
                  onClick={() => {
                    setHistory([]);
                    localStorage.removeItem('sql_query_history');
                  }}
                  className="text-[10px] text-gray-500 hover:text-white transition-colors"
                >
                  Clear History
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <div className="text-center py-6 text-gray-600 text-xs">
                No past executed queries.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map((histQuery, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery(histQuery);
                      setResult(null);
                    }}
                    className="w-full text-left p-2.5 rounded-lg border border-transparent hover:border-white/10 bg-white/5 hover:bg-white/10 font-mono text-[10px] text-gray-400 hover:text-white transition-all truncate"
                    title={histQuery}
                  >
                    {histQuery}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ==================== CREATE TABLE ANIMATION OVERLAY ==================== */}
      {showAnimation && animationData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/90 backdrop-blur-md">
          <div className="max-w-xl w-full p-8 glass-card border-primary-500/30 flex flex-col items-center relative overflow-hidden animate-slide-up">
            
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary-500/10 rounded-full blur-2xl animate-pulse" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl animate-pulse" />

            <h2 className="text-xl font-extrabold text-white tracking-tight mb-8">
              SQL Engine <span className="gradient-text">Schema Update</span>
            </h2>

            <div className="w-full flex flex-col items-center space-y-6 relative">
              <div className={`p-4 rounded-2xl border flex flex-col items-center justify-center transition-all duration-500 ${
                animationStep === 0 
                  ? 'bg-primary-500/20 border-primary-500/50 ring-4 ring-primary-500/10 scale-110 shadow-lg shadow-primary-500/20' 
                  : 'bg-white/5 border-white/10 text-gray-500'
              }`}>
                <svg className="w-8 h-8 mb-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125v-3.75" />
                </svg>
                <span className="text-xs font-mono font-bold">DATABASE</span>
              </div>

              <div className="flex flex-col items-center">
                <div className={`h-8 w-0.5 border-l-2 border-dashed transition-colors duration-500 ${
                  animationStep >= 1 ? 'border-primary-500 animate-pulse' : 'border-white/10'
                }`} />
                <div className={`text-xl transition-all duration-500 ${
                  animationStep >= 1 ? 'text-primary-400 translate-y-1' : 'text-gray-600'
                }`}>
                  ↓
                </div>
              </div>

              <div className={`w-full max-w-sm rounded-2xl border p-5 transition-all duration-700 ${
                animationStep === 0 
                  ? 'opacity-0 scale-75 border-transparent bg-transparent' 
                  : animationStep === 3 
                    ? 'opacity-100 scale-105 bg-emerald-500/10 border-emerald-500/60 shadow-lg shadow-emerald-500/10 ring-4 ring-emerald-500/5'
                    : 'opacity-100 scale-100 bg-white/5 border-primary-500/40 ring-4 ring-primary-500/5 shadow-lg shadow-primary-500/5'
              }`}>
                <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📊</span>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      {animationData.tableName}
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500">NEW TABLE</span>
                </div>

                {animationStep >= 2 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {visibleColumns.map((col, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center text-xs font-mono bg-white/5 p-2 rounded border border-white/5 animate-slide-up"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-emerald-400 font-bold">●</span>
                          <span className="text-white">{col.columnName}</span>
                          {col.isPk && (
                            <span className="text-[8px] bg-amber-500/25 border border-amber-500/30 text-amber-400 px-1 py-0.2 rounded font-bold">PK</span>
                          )}
                        </div>
                        <span className="text-gray-500">{col.dataType}</span>
                      </div>
                    ))}
                    
                    {animationStep === 2 && visibleColumns.length < animationData.columns.length && (
                      <div className="flex items-center justify-center py-2 text-[10px] font-mono text-gray-500 gap-2">
                        <div className="animate-spin w-3 h-3 border border-primary-500 border-t-transparent rounded-full" />
                        Generating columns...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {animationStep === 3 && (
              <div className="mt-8 flex flex-col items-center space-y-3 animate-fade-in">
                <div className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Schema table compiled and written successfully!
                </div>
                <button
                  onClick={() => setShowAnimation(false)}
                  className="px-6 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  Dismiss Overlay
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ==================== INSERT INTO RECORD PIPELINE ANIMATION ==================== */}
      {showInsertAnimation && insertAnimData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/90 backdrop-blur-md">
          <div className="max-w-4xl w-full p-8 glass-card border-primary-500/30 flex flex-col items-center relative overflow-hidden animate-slide-up">
            
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl animate-pulse" />

            <h2 className="text-xl font-extrabold text-white tracking-tight mb-8">
              SQL Engine <span className="gradient-text">Data Insertion</span>
            </h2>

            <div className="w-full flex flex-col items-center space-y-6 relative">
              <div className="w-full max-w-md flex flex-col items-center">
                <div className={`w-full max-w-sm rounded-xl border p-4 bg-white/5 border-emerald-500/40 shadow-lg shadow-emerald-500/10 transition-all duration-1000 transform ${
                  insertAnimStep >= 1 ? 'translate-y-24 opacity-0 scale-75' : 'translate-y-0 opacity-100 scale-100'
                }`}>
                  <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-2 flex justify-between">
                    <span>INSERT payload row</span>
                    <span>{insertAnimStep === 0 ? 'Queued' : 'Writing...'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    {Object.entries(insertAnimData.rowData).map(([col, val]) => (
                      <div key={col} className="bg-white/5 px-2 py-1 rounded truncate">
                        <span className="text-gray-500 mr-1">{col}:</span>
                        <span className="text-white font-semibold">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="h-6 flex flex-col items-center">
                <div className="h-4 w-0.5 border-l-2 border-dashed border-emerald-500/50 animate-pulse" />
                <div className="text-emerald-400 text-xs animate-bounce">↓</div>
              </div>

              <div className="w-full border border-white/10 rounded-xl overflow-hidden bg-surface-950 p-4">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-3">
                  DB Table Preview: <strong className="text-primary-400 font-mono">{insertAnimData.tableName}</strong>
                </div>

                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-gray-500 font-bold uppercase">
                        {existingTableColumns.map(col => (
                          <th key={col} className="px-3 py-2 font-mono">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-400">
                      {existingTableRows.slice(-3).map((row, idx) => (
                        <tr key={idx}>
                          {existingTableColumns.map(col => (
                            <td key={col} className="px-3 py-2 font-mono truncate max-w-[120px]">{'' + (row[col] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                      
                      {insertAnimStep >= 1 && (
                        <tr className={`transition-all duration-500 ${
                          insertAnimStep === 2 
                            ? 'bg-emerald-500/20 text-emerald-300 font-bold animate-pulse' 
                            : 'bg-emerald-500/10 text-emerald-400 opacity-50'
                        }`}>
                          {existingTableColumns.map(col => {
                            const matchedVal = insertAnimData.rowData[col];
                            return (
                              <td key={col} className="px-3 py-2 font-mono truncate max-w-[120px] border-y border-emerald-500/30">
                                {matchedVal !== undefined ? matchedVal : (col === 'id' ? 'AUTO' : 'NOW()')}
                              </td>
                            );
                          })}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {insertAnimStep === 2 && (
              <div className="mt-8 w-full flex flex-col items-center space-y-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                  <div className="glass-card p-4 text-center border-emerald-500/20 bg-emerald-500/5">
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Rows Affected</div>
                    <div className="text-xl font-black text-emerald-400 font-mono">
                      {insertAnimData.affectedRows} Row(s)
                    </div>
                  </div>
                  <div className="glass-card p-4 text-center border-purple-500/20 bg-purple-500/5">
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Execution Time</div>
                    <div className="text-xl font-black text-purple-400 font-mono">
                      {insertAnimData.execTime?.toFixed(2) || '—'} ms
                    </div>
                  </div>
                </div>

                <div className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 mt-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Commit successful! MySQL returned OK response.
                </div>

                <button
                  onClick={() => setShowInsertAnimation(false)}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  Confirm Commit
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ==================== SELECT TABLE SCAN PIPELINE ANIMATION ==================== */}
      {showSelectAnimation && selectAnimData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/90 backdrop-blur-md">
          <div className="max-w-4xl w-full p-8 glass-card border-primary-500/30 flex flex-col items-center relative overflow-hidden animate-slide-up">
            
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary-500/10 rounded-full blur-2xl animate-pulse" />

            <div className="w-full flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  SQL Engine <span className="gradient-text">Table Scan</span>
                </h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Scanning table: <strong className="text-primary-400 uppercase">{selectAnimData.tableName}</strong>
                </p>
              </div>
              
              {selectScanComplete && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="bg-purple-500/15 border border-purple-500/30 text-purple-400 px-3 py-1 rounded-lg text-xs font-mono">
                    Time: <strong>{selectAnimData.execTime?.toFixed(2) || '—'} ms</strong>
                  </div>
                  <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-lg text-xs font-mono">
                    Matched: <strong>{selectAnimData.matchingRows.length} Rows</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="w-full border border-white/10 rounded-xl overflow-hidden bg-surface-950 p-4 relative min-h-[250px]">
              {!selectScanComplete && selectScanIndex >= 0 && selectScanIndex < selectAnimData.allRows.length && (
                <div 
                  className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-primary-500 to-transparent shadow-lg shadow-primary-500/50 transition-all duration-300 pointer-events-none"
                  style={{
                    top: `${48 + (selectScanIndex * 33)}px`
                  }}
                />
              )}

              <div className="overflow-x-auto max-h-[300px]">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10 text-gray-500 font-bold uppercase">
                      <th className="px-3 py-2">Status</th>
                      {selectAnimData.columns.map(col => (
                        <th key={col} className="px-3 py-2 font-mono">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-400">
                    {selectAnimData.allRows.map((row, idx) => {
                      const isCurrent = selectScanIndex === idx;
                      const isMatched = scanMatchedIds.has(idx);
                      const isHidden = selectScanComplete && !isMatched;

                      return (
                        <tr 
                          key={idx}
                          className={`transition-all duration-500 ${
                            isHidden ? 'opacity-0 scale-y-0 h-0 hidden' : ''
                          } ${
                            isCurrent 
                              ? 'bg-primary-500/20 text-white font-semibold border-y border-primary-500/30' 
                              : isMatched 
                                ? 'bg-emerald-500/10 text-emerald-400 font-medium' 
                                : selectScanComplete 
                                  ? 'opacity-30'
                                  : ''
                          }`}
                        >
                          <td className="px-3 py-2 font-bold font-mono">
                            {isCurrent ? (
                              <span className="text-primary-400 animate-pulse">🔎 SCANNING</span>
                            ) : isMatched ? (
                              <span className="text-emerald-400">✅ MATCH</span>
                            ) : selectScanComplete ? (
                              <span className="text-gray-600">❌ SKIP</span>
                            ) : (
                              <span className="text-gray-700">WAITING</span>
                            )}
                          </td>
                          {selectAnimData.columns.map(col => (
                            <td key={col} className="px-3 py-2 font-mono truncate max-w-[150px]">
                              {'' + (row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center">
              {!selectScanComplete ? (
                <div className="text-xs text-primary-400 font-mono animate-pulse flex items-center gap-2">
                  <div className="animate-spin w-3 h-3 border border-primary-500 border-t-transparent rounded-full" />
                  Running sequential index scanner: checking record {selectScanIndex + 1} of {selectAnimData.allRows.length}...
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3 animate-fade-in">
                  <div className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Scan complete! Non-matching records filtered out of output buffer.
                  </div>
                  <button
                    onClick={() => setShowSelectAnimation(false)}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                  >
                    View Result Table
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ==================== UPDATE CELL INPLACE PIPELINE ANIMATION ==================== */}
      {showUpdateAnimation && updateAnimData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/90 backdrop-blur-md">
          <div className="max-w-4xl w-full p-8 glass-card border-primary-500/30 flex flex-col items-center relative overflow-hidden animate-slide-up">
            
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl animate-pulse" />

            <div className="w-full flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  SQL Engine <span className="gradient-text">Row Mutation</span>
                </h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Modifying table: <strong className="text-primary-400 uppercase">{updateAnimData.tableName}</strong>
                </p>
              </div>

              {updateAnimStep === 2 && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="bg-purple-500/15 border border-purple-500/30 text-purple-400 px-3 py-1 rounded-lg text-xs font-mono">
                    Time: <strong>{updateAnimData.execTime?.toFixed(2) || '—'} ms</strong>
                  </div>
                  <div className="bg-amber-500/15 border border-amber-500/30 text-amber-400 px-3 py-1 rounded-lg text-xs font-mono">
                    Updated: <strong>{updateAnimData.affectedRows} Row(s)</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="w-full border border-white/10 rounded-xl overflow-hidden bg-surface-950 p-6">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-4">
                Active Table Row State:
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10 text-gray-500 font-bold uppercase">
                      {updateAnimData.columns.map(col => (
                        <th key={col} className="px-3 py-2.5 font-mono">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="text-gray-300">
                      {updateAnimData.columns.map(col => {
                        const isFieldUpdated = updateAnimData.updates.some(u => u.column === col);
                        const updateObj = updateAnimData.updates.find(u => u.column === col);
                        const oldValue = updateAnimData.oldRow[col];
                        
                        return (
                          <td 
                            key={col} 
                            className={`px-3 py-3 font-mono font-bold transition-all duration-700 ${
                              isFieldUpdated 
                                ? updateAnimStep === 0 
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 rounded scale-105' 
                                  : updateAnimStep === 1 
                                    ? 'bg-amber-500/10 text-amber-400 scale-100'
                                    : 'bg-amber-500/30 text-white shadow-inner scale-100 border border-amber-500/50 animate-pulse'
                                : ''
                            }`}
                          >
                            {isFieldUpdated ? (
                              updateAnimStep === 0 ? (
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider">OLD VALUE</span>
                                  <span>{'' + (oldValue !== undefined ? oldValue : '—')}</span>
                                </div>
                              ) : (
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">NEW VALUE</span>
                                  <span>{updateObj.newValue}</span>
                                </div>
                              )
                            ) : (
                              '' + (updateAnimData.oldRow[col] !== undefined ? updateAnimData.oldRow[col] : '—')
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center">
              {updateAnimStep === 0 ? (
                <div className="text-xs text-red-400 font-mono animate-pulse flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
                  Targeting row cells containing old column properties...
                </div>
              ) : updateAnimStep === 1 ? (
                <div className="text-xs text-amber-400 font-mono animate-pulse flex items-center gap-2">
                  <div className="animate-spin w-3 h-3 border border-amber-500 border-t-transparent rounded-full" />
                  Overwriting memory address values inside MySQL database...
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3 animate-fade-in">
                  <div className="text-xs text-amber-400 font-bold flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Row updated successfully! Cell values flashed and updated in place.
                  </div>
                  <button
                    onClick={() => setShowUpdateAnimation(false)}
                    className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                  >
                    Confirm Mutation
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ==================== DELETE RECORD PIPELINE ANIMATION ==================== */}
      {showDeleteAnimation && deleteAnimData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/90 backdrop-blur-md">
          <div className="max-w-4xl w-full p-8 glass-card border-red-500/30 flex flex-col items-center relative overflow-hidden animate-slide-up">
            
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/10 rounded-full blur-2xl animate-pulse" />

            <div className="w-full flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  SQL Engine <span className="text-red-400">Row Deletion</span>
                </h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Removing from table: <strong className="text-red-400 uppercase">{deleteAnimData.tableName}</strong>
                </p>
              </div>

              {deleteAnimStep === 2 && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="bg-purple-500/15 border border-purple-500/30 text-purple-400 px-3 py-1 rounded-lg text-xs font-mono">
                    Time: <strong>{deleteAnimData.execTime?.toFixed(2) || '—'} ms</strong>
                  </div>
                  <div className="bg-red-500/15 border border-red-500/30 text-red-400 px-3 py-1 rounded-lg text-xs font-mono">
                    Deleted: <strong>{deleteAnimData.affectedRows} Row(s)</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Deletion Grid */}
            <div className="w-full border border-white/10 rounded-xl overflow-hidden bg-surface-950 p-4">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-3">
                Table Records Grid:
              </div>

              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10 text-gray-500 font-bold uppercase">
                      <th className="px-3 py-2">Status</th>
                      {deleteAnimData.columns.map(col => (
                        <th key={col} className="px-3 py-2 font-mono">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {deleteAnimData.allRows.map((row, idx) => {
                      const isTarget = checkRowMatch(row, deleteAnimData.deletedRows);
                      
                      // Animate row removal/collapse
                      const isCollapsed = deleteAnimStep === 2 && isTarget;
                      const isFading = deleteAnimStep >= 1 && isTarget;

                      return (
                        <tr 
                          key={idx}
                          className={`transition-all duration-700 ${
                            isCollapsed ? 'opacity-0 scale-y-0 h-0 hidden' : ''
                          } ${
                            isTarget 
                              ? isFading
                                ? 'bg-red-950 text-red-500 opacity-20 scale-95 border-y border-red-500/20' 
                                : 'bg-red-500/20 text-red-400 font-bold border-y border-red-500/50 animate-pulse'
                              : 'text-gray-400'
                          }`}
                        >
                          <td className="px-3 py-2 font-bold font-mono">
                            {isTarget ? (
                              deleteAnimStep === 0 ? (
                                <span className="text-red-400 font-bold uppercase">🚩 DELETING</span>
                              ) : (
                                <span className="text-red-600 uppercase">💨 FADED</span>
                              )
                            ) : (
                              <span className="text-gray-600">RETAINED</span>
                            )}
                          </td>
                          {deleteAnimData.columns.map(col => (
                            <td key={col} className="px-3 py-2 font-mono truncate max-w-[150px]">
                              {'' + (row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Animation Steps Status */}
            <div className="mt-8 flex flex-col items-center">
              {deleteAnimStep === 0 ? (
                <div className="text-xs text-red-400 font-mono animate-pulse flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
                  Targeting selected row(s) to highlight deletion...
                </div>
              ) : deleteAnimStep === 1 ? (
                <div className="text-xs text-red-500 font-mono animate-pulse flex items-center gap-2">
                  <div className="animate-spin w-3 h-3 border border-red-500 border-t-transparent rounded-full" />
                  De-allocating memory and dropping rows from database buffer...
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3 animate-fade-in">
                  <div className="text-xs text-red-400 font-bold flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Row(s) deallocated and removed successfully! Affected counts updated.
                  </div>
                  <button
                    onClick={() => setShowDeleteAnimation(false)}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                  >
                    Confirm Deletion
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ==================== JOIN ANIMATION OVERLAY ==================== */}
      {showJoinAnimation && joinAnimData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/90 backdrop-blur-md overflow-y-auto py-8">
          <div className="max-w-6xl w-full mx-4 p-8 glass-card border-cyan-500/30 flex flex-col items-center relative overflow-hidden animate-slide-up">
            
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-2xl animate-pulse" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl animate-pulse" />

            {/* Header */}
            <div className="w-full flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  SQL Engine <span className="text-cyan-400">{joinAnimData.joinType}</span> Operation
                </h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  <strong className="text-cyan-400 uppercase">{joinAnimData.leftTable}</strong>
                  {' '}⟷{' '}
                  <strong className="text-indigo-400 uppercase">{joinAnimData.rightTable}</strong>
                  {' '}ON{' '}
                  <span className="text-gray-400">{joinAnimData.onClause}</span>
                </p>
              </div>

              {joinAnimStep === 2 && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="bg-purple-500/15 border border-purple-500/30 text-purple-400 px-3 py-1 rounded-lg text-xs font-mono">
                    Time: <strong>{joinAnimData.execTime?.toFixed(2) || '—'} ms</strong>
                  </div>
                  <div className="bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 px-3 py-1 rounded-lg text-xs font-mono">
                    Matched: <strong>{joinAnimData.totalMatches} Row(s)</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Two Tables + SVG Connection Lines */}
            <div className="w-full relative" ref={joinContainerRef}>
              <div className="grid grid-cols-2 gap-16">
                
                {/* LEFT TABLE */}
                <div className={`border border-cyan-500/20 rounded-xl overflow-hidden bg-surface-950 transition-all duration-700 ${
                  joinAnimStep >= 0 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
                }`}>
                  <div className="bg-cyan-500/10 px-4 py-2.5 border-b border-cyan-500/20 flex items-center gap-2">
                    <span className="text-base">📋</span>
                    <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">{joinAnimData.leftTable}</span>
                    <span className="text-[9px] text-gray-500 font-mono ml-auto">{joinAnimData.leftRows.length} rows</span>
                  </div>
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10 text-gray-500 font-bold uppercase">
                          {joinAnimData.leftCols.map(col => (
                            <th key={col} className={`px-3 py-2 font-mono ${
                              col === joinAnimData.leftCol ? 'text-cyan-400 bg-cyan-500/10' : ''
                            }`}>
                              {col === joinAnimData.leftCol && '🔑 '}{col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {joinAnimData.leftRows.map((row, idx) => {
                          const isMatched = joinAnimStep >= 1 && joinAnimData.matchPairs
                            .slice(0, joinVisibleLines)
                            .some(p => p.leftIdx === idx);
                          return (
                            <tr 
                              key={idx} 
                              data-left-row={idx}
                              className={`transition-all duration-500 ${
                                isMatched 
                                  ? 'bg-cyan-500/15 text-cyan-300 font-semibold' 
                                  : 'text-gray-400'
                              }`}
                            >
                              {joinAnimData.leftCols.map(col => (
                                <td key={col} className={`px-3 py-2 font-mono truncate max-w-[120px] ${
                                  col === joinAnimData.leftCol ? 'font-bold text-cyan-400' : ''
                                }`}>
                                  {'' + (row[col] ?? '')}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* RIGHT TABLE */}
                <div className={`border border-indigo-500/20 rounded-xl overflow-hidden bg-surface-950 transition-all duration-700 ${
                  joinAnimStep >= 0 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
                }`}>
                  <div className="bg-indigo-500/10 px-4 py-2.5 border-b border-indigo-500/20 flex items-center gap-2">
                    <span className="text-base">📋</span>
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{joinAnimData.rightTable}</span>
                    <span className="text-[9px] text-gray-500 font-mono ml-auto">{joinAnimData.rightRows.length} rows</span>
                  </div>
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10 text-gray-500 font-bold uppercase">
                          {joinAnimData.rightCols.map(col => (
                            <th key={col} className={`px-3 py-2 font-mono ${
                              col === joinAnimData.rightCol ? 'text-indigo-400 bg-indigo-500/10' : ''
                            }`}>
                              {col === joinAnimData.rightCol && '🔑 '}{col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {joinAnimData.rightRows.map((row, idx) => {
                          const isMatched = joinAnimStep >= 1 && joinAnimData.matchPairs
                            .slice(0, joinVisibleLines)
                            .some(p => p.rightIdx === idx);
                          return (
                            <tr 
                              key={idx}
                              data-right-row={idx}
                              className={`transition-all duration-500 ${
                                isMatched 
                                  ? 'bg-indigo-500/15 text-indigo-300 font-semibold' 
                                  : 'text-gray-400'
                              }`}
                            >
                              {joinAnimData.rightCols.map(col => (
                                <td key={col} className={`px-3 py-2 font-mono truncate max-w-[120px] ${
                                  col === joinAnimData.rightCol ? 'font-bold text-indigo-400' : ''
                                }`}>
                                  {'' + (row[col] ?? '')}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* SVG Connection Lines Overlay */}
              {joinAnimStep >= 1 && joinAnimData.matchPairs.length > 0 && (
                <svg 
                  className="absolute inset-0 w-full h-full pointer-events-none" 
                  style={{ zIndex: 10 }}
                >
                  <defs>
                    <linearGradient id="joinLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
                      <stop offset="50%" stopColor="#a78bfa" stopOpacity="1" />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity="0.9" />
                    </linearGradient>
                    <filter id="glowFilter">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  {joinAnimData.matchPairs.slice(0, joinVisibleLines).map((pair, idx) => {
                    // Calculate Y positions based on row index
                    // Each row is ~29px tall, header is ~33px, table header area ~41px  
                    const rowHeight = 29;
                    const headerOffset = 41 + 33;
                    const leftY = headerOffset + (pair.leftIdx * rowHeight) + (rowHeight / 2);
                    const rightY = headerOffset + (pair.rightIdx * rowHeight) + (rowHeight / 2);
                    
                    // X: left table ends at ~48%, right table starts at ~52%
                    const x1 = '48%';
                    const x2 = '52%';
                    const x1Num = 48;
                    const x2Num = 52;
                    const cpx1 = 50; // control point X (percent)

                    return (
                      <g key={idx} className="animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
                        {/* Glow line */}
                        <path
                          d={`M ${x1Num}% ${leftY} C ${cpx1}% ${leftY}, ${cpx1}% ${rightY}, ${x2Num}% ${rightY}`}
                          fill="none"
                          stroke="url(#joinLineGrad)"
                          strokeWidth="2.5"
                          filter="url(#glowFilter)"
                          strokeLinecap="round"
                          opacity="0.5"
                        />
                        {/* Main line */}
                        <path
                          d={`M ${x1Num}% ${leftY} C ${cpx1}% ${leftY}, ${cpx1}% ${rightY}, ${x2Num}% ${rightY}`}
                          fill="none"
                          stroke="url(#joinLineGrad)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        {/* Left dot */}
                        <circle cx={x1} cy={leftY} r="4" fill="#22d3ee" filter="url(#glowFilter)" />
                        {/* Right dot */}
                        <circle cx={x2} cy={rightY} r="4" fill="#818cf8" filter="url(#glowFilter)" />
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>

            {/* Animation Progress Steps */}
            <div className="w-full mt-6 flex justify-center">
              <div className="flex items-center gap-3">
                {[
                  { label: 'Load Tables', icon: '📋', active: joinAnimStep >= 0 },
                  { label: 'Match Rows', icon: '🔗', active: joinAnimStep >= 1 },
                  { label: 'Build Result', icon: '✨', active: joinAnimStep >= 2 },
                ].map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {idx > 0 && (
                      <div className={`w-8 h-0.5 rounded transition-all duration-500 ${
                        step.active ? 'bg-cyan-400' : 'bg-gray-700'
                      }`} />
                    )}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-500 ${
                      step.active
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                        : 'bg-white/5 text-gray-600 border border-white/5'
                    }`}>
                      <span>{step.icon}</span>
                      <span>{step.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step status messages */}
            <div className="mt-4 flex flex-col items-center">
              {joinAnimStep === 0 ? (
                <div className="text-xs text-cyan-400 font-mono animate-pulse flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                  Loading source table data from database buffer...
                </div>
              ) : joinAnimStep === 1 ? (
                <div className="text-xs text-purple-400 font-mono animate-pulse flex items-center gap-2">
                  <div className="animate-spin w-3 h-3 border border-purple-500 border-t-transparent rounded-full" />
                  Scanning rows for matching keys... ({joinVisibleLines}/{joinAnimData.matchPairs.length} pairs found)
                </div>
              ) : null}
            </div>

            {/* JOINED RESULT TABLE — only shown at step 2 */}
            {joinAnimStep === 2 && (
              <div className="w-full mt-6 animate-slide-up">
                <div className="border border-emerald-500/20 rounded-xl overflow-hidden bg-surface-950">
                  <div className="bg-emerald-500/10 px-4 py-2.5 border-b border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔗</span>
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        Joined Result
                      </span>
                      <span className="text-[9px] text-gray-500 font-mono">
                        ({joinAnimData.totalMatches} rows)
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[9px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono border border-cyan-500/20">
                        {joinAnimData.leftTable}
                      </span>
                      <span className="text-[9px] text-gray-500">⟷</span>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono border border-indigo-500/20">
                        {joinAnimData.rightTable}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10 text-gray-500 font-bold uppercase">
                          {joinAnimData.resultColumns.map((col, cIdx) => (
                            <th key={cIdx} className="px-3 py-2 font-mono">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {joinAnimData.resultData.map((row, rIdx) => (
                          <tr 
                            key={rIdx} 
                            className="text-gray-300 hover:bg-white/5 transition-all animate-fade-in"
                            style={{ animationDelay: `${rIdx * 60}ms` }}
                          >
                            {joinAnimData.resultColumns.map((col, cIdx) => (
                              <td key={cIdx} className="px-3 py-2 font-mono truncate max-w-[160px]">
                                {row[col] === null ? (
                                  <span className="text-gray-600 italic">NULL</span>
                                ) : (
                                  '' + row[col]
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Final confirmation */}
                <div className="mt-6 flex flex-col items-center space-y-3">
                  <div className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    JOIN operation complete! {joinAnimData.totalMatches} matching rows merged from {joinAnimData.leftTable} ⟷ {joinAnimData.rightTable}.
                  </div>
                  <button
                    onClick={() => setShowJoinAnimation(false)}
                    className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
                  >
                    Close Visualization
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ==================== GROUP BY ANIMATION OVERLAY ==================== */}
      {showGroupByAnimation && groupByAnimData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/90 backdrop-blur-md overflow-y-auto py-8">
          <div className="max-w-6xl w-full mx-4 p-8 glass-card border-violet-500/30 flex flex-col items-center relative overflow-hidden animate-slide-up">
            
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-violet-500/10 rounded-full blur-2xl animate-pulse" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-fuchsia-500/10 rounded-full blur-2xl animate-pulse" />

            {/* Header */}
            <div className="w-full flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  SQL Engine <span className="text-violet-400">GROUP BY</span> Query
                </h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Grouping table <strong className="text-violet-400 uppercase">{groupByAnimData.tableName}</strong>
                  {' '}by column:{' '}
                  <strong className="text-fuchsia-400 font-mono">{groupByAnimData.groupCol}</strong>
                </p>
              </div>

              {groupByAnimStep === 2 && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="bg-purple-500/15 border border-purple-500/30 text-purple-400 px-3 py-1 rounded-lg text-xs font-mono">
                    Time: <strong>{groupByAnimData.execTime?.toFixed(2) || '—'} ms</strong>
                  </div>
                  <div className="bg-violet-500/15 border border-violet-500/30 text-violet-400 px-3 py-1 rounded-lg text-xs font-mono">
                    Groups: <strong>{groupByAnimData.totalGroups}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Layout: Raw rows to Buckets */}
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Raw Records Table */}
              <div className="lg:col-span-5 border border-white/5 rounded-xl overflow-hidden bg-surface-950 p-4">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Source Dataset Buffer</span>
                  {groupByAnimStep === 0 && <span className="text-cyan-400 font-mono animate-pulse">Ungrouped state</span>}
                  {groupByAnimStep >= 1 && <span className="text-violet-400 font-mono animate-pulse">Color-mapping keys...</span>}
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-gray-400 font-bold uppercase">
                        {groupByAnimData.tableCols.map(col => (
                          <th key={col} className={`px-2.5 py-2 font-mono ${col === groupByAnimData.groupCol ? 'text-violet-400 bg-violet-500/5' : ''}`}>
                            {col === groupByAnimData.groupCol && '🔑 '}{col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {groupByAnimData.allRows.map((row, idx) => {
                        const groupValue = '' + (row[groupByAnimData.groupCol] ?? 'NULL');
                        const targetGroupIdx = groupByAnimData.groups.findIndex(g => g.key === groupValue);
                        const isGroupActive = groupByAnimStep >= 1 && targetGroupIdx < groupByVisibleGroups;
                        const groupColor = isGroupActive ? groupByAnimData.groups[targetGroupIdx].color : null;

                        return (
                          <tr 
                            key={idx}
                            className={`transition-all duration-500 ${
                              groupColor 
                                ? `${groupColor.bg} ${groupColor.text} font-semibold border-l-4 border-violet-500` 
                                : 'text-gray-400'
                            }`}
                          >
                            {groupByAnimData.tableCols.map(col => (
                              <td key={col} className={`px-2.5 py-1.5 font-mono truncate max-w-[100px] ${col === groupByAnimData.groupCol ? 'font-bold' : ''}`}>
                                {'' + (row[col] ?? 'NULL')}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Grouped Buckets & Aggregate Cards */}
              <div className="lg:col-span-7 space-y-6">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  Color-Coded Groups & Aggregates
                </div>

                {groupByAnimStep === 0 ? (
                  <div className="border border-white/5 rounded-xl bg-surface-950/40 p-12 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full border border-dashed border-gray-600 flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <p className="text-xs text-gray-500 font-mono">Ready to partition records into memory buckets...</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
                    {groupByAnimData.groups.slice(0, groupByVisibleGroups).map((group, gIdx) => (
                      <div 
                        key={gIdx} 
                        className={`p-4 border rounded-xl bg-surface-950/60 shadow-lg ${group.color.border} ${group.color.glow} transition-all duration-500 animate-slide-up`}
                      >
                        {/* Group Title / Value */}
                        <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${group.color.dot}`} />
                            <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">GROUP VALUE:</span>
                            <span className={`text-xs font-mono font-bold ${group.color.text}`}>{group.key}</span>
                          </div>
                          <span className="text-[9px] text-gray-500 font-mono">{group.rows.length} rows inside</span>
                        </div>

                        {/* Aggregate Cards */}
                        {groupByAnimStep >= 2 && (
                          <div className="grid grid-cols-3 gap-3">
                            {group.aggCards.map((card, cIdx) => {
                              // Compute global index to map with groupByVisibleCards
                              let previousCardsCount = 0;
                              for (let i = 0; i < gIdx; i++) {
                                previousCardsCount += groupByAnimData.groups[i].aggCards.length;
                              }
                              const cardGlobalIdx = previousCardsCount + cIdx;
                              const isCardVisible = cardGlobalIdx < groupByVisibleCards;

                              if (!isCardVisible) return <div key={cIdx} className="h-16" />;

                              return (
                                <div 
                                  key={cIdx} 
                                  className="bg-white/5 border border-white/10 rounded-lg p-2.5 flex flex-col justify-between hover:bg-white/10 transition-all duration-300 transform scale-100 hover:scale-105 animate-slide-up"
                                >
                                  <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider font-mono">
                                    {card.fn}({card.column})
                                  </div>
                                  <div className={`text-lg font-extrabold font-mono leading-none mt-1 ${group.color.text}`}>
                                    {card.value}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Steps Timeline Indicator */}
            <div className="w-full mt-6 flex justify-center">
              <div className="flex items-center gap-3">
                {[
                  { label: 'Parse Rows', icon: '📋', active: groupByAnimStep >= 0 },
                  { label: 'Map Colors', icon: '🎨', active: groupByAnimStep >= 1 },
                  { label: 'Aggregate Stats', icon: '📊', active: groupByAnimStep >= 2 },
                ].map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {idx > 0 && (
                      <div className={`w-8 h-0.5 rounded transition-all duration-500 ${
                        step.active ? 'bg-violet-400' : 'bg-gray-700'
                      }`} />
                    )}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-500 ${
                      step.active
                        ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30 shadow-lg shadow-violet-500/10'
                        : 'bg-white/5 text-gray-600 border border-white/5'
                    }`}>
                      <span>{step.icon}</span>
                      <span>{step.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* final summary result table */}
            {groupByAnimStep === 2 && (
              <div className="w-full mt-6 animate-slide-up">
                <div className="border border-violet-500/20 rounded-xl overflow-hidden bg-surface-950">
                  <div className="bg-violet-500/10 px-4 py-2.5 border-b border-violet-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📊</span>
                      <span className="text-xs font-bold text-violet-400 uppercase tracking-wider">
                        SQL Engine Grouped Output Table
                      </span>
                      <span className="text-[9px] text-gray-500 font-mono">
                        ({groupByAnimData.resultData.length} records returned)
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10 text-gray-500 font-bold uppercase">
                          {groupByAnimData.resultColumns.map((col, cIdx) => (
                            <th key={cIdx} className="px-3 py-2 font-mono">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {groupByAnimData.resultData.map((row, rIdx) => (
                          <tr 
                            key={rIdx}
                            className="text-gray-300 hover:bg-white/5 transition-all animate-fade-in"
                            style={{ animationDelay: `${rIdx * 50}ms` }}
                          >
                            {groupByAnimData.resultColumns.map((col, cIdx) => (
                              <td key={cIdx} className="px-3 py-2 font-mono truncate max-w-[160px]">
                                {row[col] === null ? (
                                  <span className="text-gray-600 italic">NULL</span>
                                ) : (
                                  '' + row[col]
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Confirm actions */}
                <div className="mt-6 flex flex-col items-center space-y-3">
                  <div className="text-xs text-violet-400 font-bold flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    GROUP BY visualization finished successfully! Statistics computed in buffer memory.
                  </div>
                  <button
                    onClick={() => setShowGroupByAnimation(false)}
                    className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-violet-500/20 active:scale-95 transition-all"
                  >
                    Confirm Grouping
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ==================== ORDER BY SORTING ANIMATION OVERLAY ==================== */}
      {showSortAnimation && sortAnimData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/90 backdrop-blur-md overflow-y-auto py-8">
          <div className="max-w-4xl w-full mx-4 p-8 glass-card border-amber-500/30 flex flex-col items-center relative overflow-hidden animate-slide-up">
            
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl animate-pulse" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl animate-pulse" />

            {/* Header */}
            <div className="w-full flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  SQL Engine <span className="text-amber-400">ORDER BY</span> Sorting
                </h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Sorting table <strong className="text-amber-400 uppercase">{sortAnimData.tableName}</strong>
                  {' '}by column:{' '}
                  <strong className="text-emerald-400 font-mono">{sortAnimData.sortCol}</strong>
                  {' '}(<span className="text-gray-300 font-bold uppercase">{sortAnimData.direction}</span>)
                </p>
              </div>

              {sortAnimStep === 2 && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="bg-purple-500/15 border border-purple-500/30 text-purple-400 px-3 py-1 rounded-lg text-xs font-mono">
                    Time: <strong>{sortAnimData.execTime?.toFixed(2) || '—'} ms</strong>
                  </div>
                  <div className="bg-amber-500/15 border border-amber-500/30 text-amber-400 px-3 py-1 rounded-lg text-xs font-mono">
                    Rows: <strong>{sortAnimData.totalRows}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Sorting Visualization Area */}
            <div className="w-full space-y-6">
              
              {/* Info Indicator Card */}
              <div className="w-full flex justify-between items-center bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Sorting Direction: {sortAnimData.direction.toUpperCase()}
                    </h4>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {sortAnimData.direction === 'asc' 
                        ? 'Ordering values from Smallest to Largest (Min → Max)' 
                        : 'Ordering values from Largest to Smallest (Max → Min)'
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className={`text-xs font-bold font-mono px-2.5 py-1 rounded ${
                    sortAnimData.direction === 'asc' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {sortAnimData.direction === 'asc' ? '▲ ASCENDING' : '▼ DESCENDING'}
                  </span>
                </div>
              </div>

              {/* Unsorted Grid shifting visually to Sorted */}
              <div className="border border-white/5 rounded-xl bg-surface-950 p-6 overflow-hidden">
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-4">
                  Visual Buffer Re-indexing
                </div>

                {/* Table Layout with relative positioning for elements to translate */}
                <div className="overflow-x-auto min-h-[460px] relative">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-gray-500 font-bold uppercase">
                        {sortAnimData.tableCols.map(col => (
                          <th key={col} className={`px-4 py-2.5 font-mono ${col === sortAnimData.sortCol ? 'text-amber-400 bg-amber-500/10' : ''}`}>
                            {col === sortAnimData.sortCol && '🎯 '}{col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="relative">
                      {sortAnimData.mappedRows.map((item, idx) => {
                        // Card height + gap is approx 38px
                        const rowHeight = 36;
                        // Determine transform translation
                        const targetY = sortAnimStep >= 1 ? (item.targetIdx - item.originalIdx) * rowHeight : 0;
                        const isHighlightCol = (col) => col === sortAnimData.sortCol;

                        return (
                          <tr 
                            key={idx}
                            style={{ 
                              transform: `translateY(${targetY}px)`,
                              transition: 'transform 1.6s cubic-bezier(0.25, 1, 0.5, 1)' 
                            }}
                            className={`border-b border-white/5 hover:bg-white/5 transition-all text-gray-300 relative ${
                              sortAnimStep >= 1 ? 'z-10' : ''
                            }`}
                          >
                            {sortAnimData.tableCols.map(col => (
                              <td 
                                key={col} 
                                className={`px-4 py-2 font-mono truncate max-w-[150px] transition-colors duration-700 ${
                                  isHighlightCol(col) 
                                    ? sortAnimStep >= 1 
                                      ? 'text-amber-400 font-bold bg-amber-500/10' 
                                      : 'text-white bg-white/5'
                                    : ''
                                }`}
                              >
                                {'' + (item.row[col] ?? 'NULL')}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Animation Steps status */}
            <div className="mt-6 flex flex-col items-center">
              {sortAnimStep === 0 ? (
                <div className="text-xs text-amber-400 font-mono animate-pulse flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  Acquired primary disk rows. Ready to execute quicksort...
                </div>
              ) : sortAnimStep === 1 ? (
                <div className="text-xs text-emerald-400 font-mono animate-pulse flex items-center gap-2">
                  <div className="animate-spin w-3 h-3 border border-emerald-500 border-t-transparent rounded-full" />
                  Sorting in progress... Reallocating index records.
                </div>
              ) : null}
            </div>

            {/* Final Sorted Result Table */}
            {sortAnimStep === 2 && (
              <div className="w-full mt-6 animate-slide-up">
                <div className="border border-emerald-500/20 rounded-xl overflow-hidden bg-surface-950">
                  <div className="bg-emerald-500/10 px-4 py-2.5 border-b border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📋</span>
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                        Sorted Result Set
                      </span>
                      <span className="text-[9px] text-gray-500 font-mono">
                        ({sortAnimData.totalRows} rows sorted)
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/10 text-gray-500 font-bold uppercase">
                          {sortAnimData.tableCols.map((col, cIdx) => (
                            <th key={cIdx} className="px-3 py-2 font-mono">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {sortAnimData.sortedRows.map((row, rIdx) => (
                          <tr 
                            key={rIdx} 
                            className="text-gray-300 hover:bg-white/5 transition-all animate-fade-in"
                            style={{ animationDelay: `${rIdx * 50}ms` }}
                          >
                            {sortAnimData.tableCols.map((col, cIdx) => (
                              <td key={cIdx} className="px-3 py-2 font-mono truncate max-w-[160px]">
                                {row[col] === null ? (
                                  <span className="text-gray-600 italic">NULL</span>
                                ) : (
                                  '' + row[col]
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Confirm action */}
                <div className="mt-6 flex flex-col items-center space-y-3">
                  <div className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Sorting complete! Data index array sorted successfully.
                  </div>
                  <button
                    onClick={() => setShowSortAnimation(false)}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                  >
                    Confirm Order
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ==================== SQL ERROR DIAGNOSTIC OVERLAY ==================== */}
      {showErrorAnimation && errorAnimData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/90 backdrop-blur-md overflow-y-auto py-8">
          <div className="max-w-3xl w-full mx-4 p-8 glass-card border-red-500/30 flex flex-col items-center relative overflow-hidden animate-slide-up">

            {/* Ambient Background Glows */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-900/5 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="w-full flex items-center gap-4 mb-6 relative z-10 border-b border-red-500/10 pb-5">
              <div className={`p-3 rounded-xl bg-red-500/15 border border-red-500/30 shadow-lg shadow-red-500/10 ${errorAnimStep >= 1 ? 'animate-[bounce_1.2s_ease-in-out_infinite]' : ''}`}>
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="text-left">
                <h2 className="text-xl font-extrabold text-white tracking-tight">
                  SQL Exception <span className="text-red-400 font-mono">Debugger</span>
                </h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Static analysis · database execution validator
                </p>
              </div>
              <div className="ml-auto flex flex-col items-end gap-1.5">
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 uppercase tracking-wider font-bold">
                  ✗ Query Failed
                </span>
                {errorAnimStep === 2 && (
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase tracking-wider font-bold animate-fade-in">
                    {errorAnimData.category}
                  </span>
                )}
              </div>
            </div>

            {/* ─── Animated Pipeline Stepper ─── */}
            <div className="w-full mb-8 relative z-10 select-none">
              <div className="flex items-start justify-between max-w-xl mx-auto relative">

                {/* Connecting bar (background) */}
                <div className="absolute top-5 left-[16%] right-[16%] h-[2px] bg-white/5 rounded-full" />
                {/* Connecting bar (fill — animates as steps advance) */}
                <div
                  className="absolute top-5 left-[16%] h-[2px] bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                  style={{ width: errorAnimStep === 0 ? '0%' : errorAnimStep === 1 ? '50%' : '84%' }}
                />

                {[
                  {
                    label: 'SQL Parser',
                    desc: 'Tokenizer',
                    icon: (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                      </svg>
                    ),
                    active: errorAnimStep >= 0, complete: errorAnimStep > 0,
                    activeColor: 'bg-red-500/20 border-red-500 text-red-400 ring-4 ring-red-500/10 shadow-lg shadow-red-500/20',
                    completeColor: 'bg-emerald-500/20 border-emerald-500 text-emerald-400',
                    inactiveColor: 'bg-surface-950 border-white/5 text-gray-600',
                  },
                  {
                    label: 'Error Detection',
                    desc: 'Schema Check',
                    icon: (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
                      </svg>
                    ),
                    active: errorAnimStep >= 1, complete: errorAnimStep > 1,
                    activeColor: 'bg-amber-500/20 border-amber-500 text-amber-400 ring-4 ring-amber-500/10 shadow-lg shadow-amber-500/20',
                    completeColor: 'bg-emerald-500/20 border-emerald-500 text-emerald-400',
                    inactiveColor: 'bg-surface-950 border-white/5 text-gray-600',
                  },
                  {
                    label: 'Diagnosis',
                    desc: 'Highlight Fault',
                    icon: (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    ),
                    active: errorAnimStep >= 2, complete: false,
                    activeColor: 'bg-red-500/20 border-red-500 text-red-400 ring-4 ring-red-500/10 shadow-lg shadow-red-500/20 scale-110',
                    completeColor: 'bg-emerald-500/20 border-emerald-500 text-emerald-400',
                    inactiveColor: 'bg-surface-950 border-white/5 text-gray-600',
                  },
                ].map((step, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-2 relative z-10">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold text-xs transition-all duration-500 ${
                        step.complete ? step.completeColor : step.active ? step.activeColor : step.inactiveColor
                      }`}
                    >
                      {step.complete ? '✓' : step.icon}
                    </div>
                    <div className="text-center">
                      <div className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-500 ${step.active ? 'text-white' : 'text-gray-600'}`}>
                        {step.label}
                      </div>
                      <div className="text-[8px] text-gray-500 font-mono">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Step status badge */}
              <div className="text-center mt-4">
                {errorAnimStep === 0 && (
                  <div className="inline-flex items-center gap-2 text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full animate-pulse">
                    <div className="animate-spin w-2.5 h-2.5 border border-red-400 border-t-transparent rounded-full" />
                    Tokenizer running · Lexical analysis in progress...
                  </div>
                )}
                {errorAnimStep === 1 && (
                  <div className="inline-flex items-center gap-2 text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    Constraint check failed · Fetching schema metadata...
                  </div>
                )}
                {errorAnimStep === 2 && (
                  <div className="inline-flex items-center gap-2 text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full animate-fade-in">
                    <span className="text-red-500">⚠</span>
                    Fault isolated · Offending token highlighted below
                  </div>
                )}
              </div>
            </div>

            {/* ─── SQL Query Terminal Window ─── */}
            <div className="w-full relative z-10 text-left mb-6">
              <div
                className={`glass-card border-white/10 rounded-xl overflow-hidden bg-surface-950 shadow-inner transition-all duration-300 ${
                  errorAnimStep === 1 ? 'border-amber-500/30 shadow-amber-500/5' :
                  errorAnimStep === 2 ? 'border-red-500/30 shadow-red-500/5' : 'border-white/10'
                }`}
              >
                {/* Terminal Window Header */}
                <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex justify-between items-center font-mono text-[10px] text-gray-500">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/30" />
                  </div>
                  <span className="flex items-center gap-1.5">
                    <span className="text-red-400">●</span>
                    query_debugger.sql
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${
                    errorAnimStep === 0 ? 'bg-blue-500/10 text-blue-400' :
                    errorAnimStep === 1 ? 'bg-amber-500/10 text-amber-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    {errorAnimStep === 0 ? 'PARSING' : errorAnimStep === 1 ? 'CHECKING' : 'ERROR'}
                  </span>
                </div>

                {/* Code Area */}
                <div className="relative p-6 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all min-h-[100px] overflow-hidden select-none">
                  {/* Stage 0: Blue laser scanner */}
                  {errorAnimStep === 0 && (
                    <>
                      <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_10px_rgba(96,165,250,0.8)] animate-laser-scan pointer-events-none" />
                      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/3 to-transparent pointer-events-none" />
                    </>
                  )}
                  {/* Stage 1: Amber alert pulsing overlay */}
                  {errorAnimStep === 1 && (
                    <>
                      <div className="absolute inset-0 bg-amber-500/5 animate-[pulse_0.8s_ease-in-out_infinite] pointer-events-none border border-amber-500/20 rounded" />
                      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_10px_rgba(251,191,36,0.6)] animate-laser-scan pointer-events-none" />
                    </>
                  )}
                  {/* Stage 2: Red tint on keyword reveal */}
                  {errorAnimStep === 2 && (
                    <div className="absolute inset-0 bg-red-500/3 pointer-events-none rounded border border-red-500/10" />
                  )}

                  <div
                    dangerouslySetInnerHTML={{
                      __html: errorAnimStep === 2
                        ? highlightFaultyKeyword(errorAnimData.query, errorAnimData.keyword)
                        : highlightSQL(errorAnimData.query)
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ─── Step 2: Full Diagnostic Panel ─── */}
            {errorAnimStep === 2 && (
              <div className="w-full relative z-10 space-y-4 animate-slide-up text-left">

                {/* Error Type Banner */}
                <div className={`w-full flex items-center gap-3 px-5 py-4 rounded-xl border font-mono shadow-lg ${
                  errorAnimData.category === 'Syntax Error'
                    ? 'bg-red-500/10 border-red-500/30'
                    : errorAnimData.category === 'Table Not Found'
                    ? 'bg-orange-500/10 border-orange-500/30'
                    : errorAnimData.category === 'Column Not Found'
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : errorAnimData.category === 'Duplicate Primary Key'
                    ? 'bg-pink-500/10 border-pink-500/30'
                    : errorAnimData.category === 'Foreign Key Violation'
                    ? 'bg-purple-500/10 border-purple-500/30'
                    : errorAnimData.category === 'Data Type Mismatch'
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : 'bg-rose-500/10 border-rose-500/30'
                }`}>
                  <span className="text-2xl select-none">
                    {errorAnimData.category === 'Syntax Error' ? '🔴' :
                     errorAnimData.category === 'Table Not Found' ? '📋' :
                     errorAnimData.category === 'Column Not Found' ? '🔍' :
                     errorAnimData.category === 'Duplicate Primary Key' ? '🔑' :
                     errorAnimData.category === 'Foreign Key Violation' ? '🔗' :
                     errorAnimData.category === 'Data Type Mismatch' ? '🔢' :
                     '🚫'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-0.5">Error Category</div>
                    <div className={`text-sm font-extrabold uppercase tracking-wide ${
                      errorAnimData.category === 'Syntax Error' ? 'text-red-400' :
                      errorAnimData.category === 'Table Not Found' ? 'text-orange-400' :
                      errorAnimData.category === 'Column Not Found' ? 'text-amber-400' :
                      errorAnimData.category === 'Duplicate Primary Key' ? 'text-pink-400' :
                      errorAnimData.category === 'Foreign Key Violation' ? 'text-purple-400' :
                      errorAnimData.category === 'Data Type Mismatch' ? 'text-blue-400' :
                      'text-rose-400'
                    }`}>
                      {errorAnimData.category}
                    </div>
                  </div>
                  {errorAnimData.keyword && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Offending Token</div>
                      <code className="bg-red-500/20 border border-red-500/50 text-red-300 px-2 py-0.5 rounded text-[11px] font-black animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                        {errorAnimData.keyword}
                      </code>
                    </div>
                  )}
                </div>

                {/* Explanation + Fix grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="glass-card border-white/10 bg-surface-950/60 p-5 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 text-xs font-bold">!</div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">What Went Wrong</div>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">{errorAnimData.explanation}</p>
                  </div>
                  <div className="glass-card border-emerald-500/10 bg-emerald-500/5 p-5 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold">✓</div>
                      <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">How To Fix</div>
                    </div>
                    <p className="text-xs text-emerald-300 leading-relaxed">{errorAnimData.fixSuggestion}</p>
                  </div>
                </div>

                {/* Error Type Quick Reference */}
                <div className="border border-white/5 rounded-xl bg-surface-950/40 p-4">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-3 font-mono flex items-center gap-2">
                    <span>📚</span> Known SQL Error Types
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { name: 'Syntax Error', icon: '🔴', color: 'border-red-500/20 text-red-400' },
                      { name: 'Table Not Found', icon: '📋', color: 'border-orange-500/20 text-orange-400' },
                      { name: 'Column Not Found', icon: '🔍', color: 'border-amber-500/20 text-amber-400' },
                      { name: 'Duplicate PK', icon: '🔑', color: 'border-pink-500/20 text-pink-400' },
                      { name: 'FK Violation', icon: '🔗', color: 'border-purple-500/20 text-purple-400' },
                      { name: 'Type Mismatch', icon: '🔢', color: 'border-blue-500/20 text-blue-400' },
                      { name: 'NOT NULL', icon: '🚫', color: 'border-rose-500/20 text-rose-400' },
                    ].map((t) => (
                      <div
                        key={t.name}
                        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border bg-white/3 text-[9px] font-mono font-semibold transition-all ${t.color} ${
                          errorAnimData.category.includes(t.name.split(' ')[0]) ? 'bg-white/10 scale-105' : ''
                        }`}
                      >
                        <span>{t.icon}</span>
                        <span className="truncate">{t.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Raw DB error */}
                <div className="border border-white/5 rounded-xl bg-surface-950/40 p-4">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 font-mono">Raw Database Exception:</div>
                  <pre className="text-[10px] font-mono text-gray-400 bg-surface-950 p-3 rounded-lg border border-white/5 overflow-x-auto max-h-24 whitespace-pre-wrap break-all select-text">
                    {errorAnimData.rawError || 'No message provided by the database engine.'}
                  </pre>
                </div>

                {/* Action Button */}
                <div className="flex justify-center gap-3 pt-1">
                  <button
                    onClick={() => {
                      setShowErrorAnimation(false);
                      if (textareaRef.current) textareaRef.current.focus();
                    }}
                    className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <span>✍ Dismiss &amp; Edit Query</span>
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
