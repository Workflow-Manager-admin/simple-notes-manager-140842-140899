/* global localStorage, crypto, window */

import './style.css';

/**
 * NOTES_APP_ROOT: The vanilla JS main entry-point for the Simple Notes Application.
 * Boots the NotesApp and handles all top-level logic for note CRUD/search.
 */

// -- State helpers & storage (very basic, in-memory + localStorage) --

const STORAGE_KEY = "simple-notes-list-v1";
function readNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}
function uuid() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11)
    .replace(/[018]/g, c=>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

// -- Top-level App Component --
function NotesApp() {
  let notes = readNotes();
  let state = {
    notes,
    search: "",
    selectedId: notes.length ? notes[0].id : null,
    mode: notes.length ? "view" : "empty", // modes: 'view' | 'edit' | 'create' | 'empty'
    form: { title: "", body: "" }
  };

  // DOM nodes (filled at render time)
  let $sidebar, $main, $search;

  function render() {
    // Determine filtered notes & states
    const filtered = state.search
      ? state.notes.filter(
          (n) =>
            n.title.toLowerCase().includes(state.search.toLowerCase()) ||
            n.body.toLowerCase().includes(state.search.toLowerCase())
        )
      : state.notes;
    const selected =
      filtered.find((n) => n.id === state.selectedId) ||
      (filtered.length ? filtered[0] : null);

    $sidebar.innerHTML = `
      <div class="sidebar-header">
        <h2>Notes</h2>
        <button class="btn btn-fab" title="New Note" id="new-note-btn">+</button>
      </div>
      <input
        class="search"
        type="text"
        id="search"
        placeholder="Search notes..."
        value="${state.search.replace(/"/g, '&quot;')}"
      />
      <ul class="notes-list" id="notes-list">
        ${filtered
          .map(
            (note) => `
          <li class="note-item ${selected && note.id === selected.id ? "active" : ""}" data-note-id="${note.id}">
            <div>
              <div class="note-title">${escapeHTML(note.title || "(untitled)")}</div>
              <div class="note-date">${new Date(note.updatedAt).toLocaleString()}</div>
            </div>
            <button class="btn btn-sm btn-delete" title="Delete" data-note-id="${note.id}">&#x1F5D1;</button>
          </li>
        `
          )
          .join("")}
      </ul>
    `;
    $search = $sidebar.querySelector("#search");
    // $list is removed as it was assigned but never used.

    $main.innerHTML =
      state.mode === "empty"
        ? `<div class="empty-message">
            <p>No notes yet. <br>
            <button class="btn btn-lg btn-primary" id="start-note-btn">Create your first note</button>
           </p>
          </div>`
        : state.mode === "edit" || state.mode === "create"
        ? buildEditForm(selected)
        : selected
        ? buildNoteView(selected)
        : `<div class="empty-message-no-select">
              <p>Select a note or create one to get started.</p>
           </div>`;

    // Bind events
    $sidebar.querySelector("#new-note-btn").onclick = () =>
      enterCreateMode();
    $search.oninput = (e) => {
      state.search = e.target.value;
      render();
    };
    [...$sidebar.querySelectorAll(".note-item")].forEach((li) => {
      li.onclick = (e) => {
        const noteId = li.dataset.noteId;
        // Ignore clicks on the delete button
        if (e.target.closest(".btn-delete")) return;
        state.selectedId = noteId;
        state.mode = "view";
        render();
      };
    });
    [...$sidebar.querySelectorAll(".btn-delete")].forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.noteId;
        confirmDeleteNote(id);
      };
    });
    if ($main.querySelector("#start-note-btn")) {
      $main.querySelector("#start-note-btn").onclick = () => enterCreateMode();
    }
    if ($main.querySelector("#edit-note-btn")) {
      $main.querySelector("#edit-note-btn").onclick = () => {
        state.mode = "edit";
        state.form = {
          title: selected.title,
          body: selected.body
        };
        render();
      };
    }
    if ($main.querySelector("#cancel-edit-btn")) {
      $main.querySelector("#cancel-edit-btn").onclick = () => {
        state.mode = "view";
        render();
      };
    }
    if ($main.querySelector("#save-note-form")) {
      $main.querySelector("#save-note-form").onsubmit = (e) => {
        e.preventDefault();
        saveNoteForm(state.mode === "edit" ? selected.id : null);
      };
    }
    if ($main.querySelector("#delete-note-btn")) {
      $main.querySelector("#delete-note-btn").onclick = () =>
        confirmDeleteNote(selected.id);
    }
  }

  // UI builder functions
  function buildEditForm() {
    const isEditing = state.mode === "edit";
    return `
      <form class="note-form" id="save-note-form" autocomplete="off">
        <input
          type="text"
          class="note-title-input"
          name="title"
          required
          maxlength="100"
          placeholder="Title"
          value="${escapeHTML(state.form.title)}"
        />
        <textarea
          class="note-body-input"
          name="body"
          placeholder="Write something..."
          required
        >${escapeHTML(state.form.body)}</textarea>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">${isEditing ? "Save" : "Create"}</button>
          <button type="button" class="btn btn-secondary" id="cancel-edit-btn">Cancel</button>
          ${
            isEditing
              ? `<button type="button" class="btn btn-danger" id="delete-note-btn">Delete</button>`
              : ""
          }
        </div>
      </form>
    `;
  }
  function buildNoteView(note) {
    return `
      <div class="note-view">
        <div class="note-view-header">
          <h2>${escapeHTML(note.title || "(untitled)")}</h2>
          <div>
            <button class="btn btn-primary" id="edit-note-btn">&#9998; Edit</button>
            <button class="btn btn-danger" id="delete-note-btn">&#x1F5D1; Delete</button>
          </div>
        </div>
        <div class="note-view-date">${new Date(note.updatedAt).toLocaleString()}</div>
        <div class="note-view-body">
          <pre>${escapeHTML(note.body)}</pre>
        </div>
      </div>
    `;
  }
  function confirmDeleteNote(noteId) {
    // Simple confirmation
    if (
      window.confirm(
        "Are you sure you want to permanently delete this note?"
      )
    ) {
      state.notes = state.notes.filter((n) => n.id !== noteId);
      saveNotes(state.notes);
      const filtered =
        state.search
          ? state.notes.filter(
              (n) =>
                n.title.toLowerCase().includes(state.search.toLowerCase()) ||
                n.body.toLowerCase().includes(state.search.toLowerCase())
            )
          : state.notes;
      if (filtered.length) {
        state.selectedId = filtered[0].id;
        state.mode = "view";
      } else {
        state.selectedId = null;
        state.mode = "empty";
      }
      render();
    }
  }
  function saveNoteForm(editId) {
    const title = $main.querySelector(".note-title-input").value.trim();
    const body = $main.querySelector(".note-body-input").value.trim();

    if (!title && !body) return;

    if (editId) {
      // Edit
      state.notes = state.notes.map((n) =>
        n.id === editId
          ? {
              ...n,
              title,
              body,
              updatedAt: Date.now()
            }
          : n
      );
      saveNotes(state.notes);
      state.selectedId = editId;
      state.mode = "view";
    } else {
      // Create
      const newId = uuid();
      const now = Date.now();
      const note = {
        id: newId,
        title,
        body,
        createdAt: now,
        updatedAt: now
      };
      state.notes = [note, ...state.notes];
      saveNotes(state.notes);
      state.selectedId = newId;
      state.mode = "view";
    }
    render();
  }
  function enterCreateMode() {
    state.mode = "create";
    state.form = { title: "", body: "" };
    render();
  }

  // Mount
  const appRoot = document.getElementById("app");
  appRoot.innerHTML = `
    <div class="notes-app-container">
      <aside class="sidebar" id="sidebar"></aside>
      <main class="main-content" id="main"></main>
    </div>
    <footer class="footer-info">
      <span>Simple Notes App &mdash; minimal &amp; light</span>
    </footer>
  `;
  $sidebar = appRoot.querySelector("#sidebar");
  $main = appRoot.querySelector("#main");

  render();
}

// Minimal escaping for safe HTML insertion
function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Boot!
NotesApp();
