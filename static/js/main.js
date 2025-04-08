// main.js

document.addEventListener('DOMContentLoaded', function() {
  const socket = io();
  socket.on('connect', () => {
    console.log('Socket connected');
  });

  /*===============================================
    1. Global Variables and Helpers
  ===============================================*/
  // Global variables that might be set from templates (e.g., via inline JS in base.html)
  window.currentCollectionId = null;
  window.currentCollectionSelect = null;
  window.currentPoemId = null;
  window.currentPoemSelect = null;
  window.poemIdToDelete = null;
  window.poemNameToDelete = null;
  // For chats (ensure these are set from your server if needed)
  window.availableUsers = window.availableUsers || [];
  window.currentUsername = window.currentUsername || "";


  const followBtn = document.getElementById('followBtn');
  if (followBtn) {
    followBtn.addEventListener('click', function() {
      const btnText = followBtn.textContent.trim();
      if (btnText === "Follow") {
        // Use a data attribute on the follow button to store the follow URL:
        const followUrl = followBtn.getAttribute('data-follow-url');
        fetch(followUrl, { method: "POST" })
          .then(response => response.json())
          .then(data => {
            if (data.status === "success") {
              followBtn.textContent = "Following";
              followBtn.classList.remove("btn-primary");
              followBtn.classList.add("btn-secondary");
              console.log("Now following user.");
            } else {
              alert("Error: " + data.message);
            }
          })
          .catch(error => console.error("Error:", error));
      } else {
        // If already following, show the unfollow confirmation modal.
        const modalEl = document.getElementById('unfollowConfirmModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
      }
    });
  }
  
  document.addEventListener("click", function(e) {
    if (e.target && e.target.id === "confirmUnfollowBtn") {
      e.preventDefault();
      const followBtn = document.getElementById('followBtn');
      const unfollowUrl = followBtn.getAttribute('data-unfollow-url');
      console.log("Unfollow button clicked. Sending request to:", unfollowUrl);
      fetch(unfollowUrl, { method: "POST" })
        .then(response => response.json())
        .then(data => {
          console.log("Unfollow response:", data);
          if (data.status === "success") {
            followBtn.textContent = "Follow";
            followBtn.classList.remove("btn-secondary");
            followBtn.classList.add("btn-primary");
            const modalEl = document.getElementById('unfollowConfirmModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            console.log("Unfollowed user, modal hidden.");
          } else {
            alert("Error: " + data.message);
          }
        })
        .catch(error => console.error("Error:", error));
    }
  });

  /*===============================================
    2. Tag Input Setup (for Add/Edit Poem pages)
  ===============================================*/
  function setupTagInput({ inputSelector, chipContainerSelector, suggestionSelector, hiddenInputSelector, initialTags = [] }) {
    const tagInput = document.querySelector(inputSelector);
    const tagChipsContainer = document.querySelector(chipContainerSelector);
    const tagSuggestions = document.querySelector(suggestionSelector);
    const tagsHidden = document.querySelector(hiddenInputSelector);
    if (!tagInput || !tagChipsContainer || !tagSuggestions || !tagsHidden) return;

    let tags = [];

    // Prepopulate tags (for edit pages)
    initialTags.forEach(function(tag) {
      addTag(tag);
    });

    function updateHiddenInput() {
      tagsHidden.value = tags.join(',');
    }

    function createTagChip(tag) {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.textContent = tag;

      const removeBtn = document.createElement('span');
      removeBtn.className = 'remove-tag';
      removeBtn.textContent = 'x';
      removeBtn.onclick = function() {
        tagChipsContainer.removeChild(chip);
        tags = tags.filter(t => t !== tag);
        updateHiddenInput();
      };

      chip.appendChild(removeBtn);
      return chip;
    }

    function addTag(tag) {
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
        const chip = createTagChip(tag);
        tagChipsContainer.appendChild(chip);
        updateHiddenInput();
      }
    }

    tagInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const tag = tagInput.value.trim();
        if (tag !== '') {
          addTag(tag);
          tagInput.value = '';
          tagSuggestions.style.display = 'none';
        }
      }
    });

    tagInput.addEventListener('input', function() {
      const query = tagInput.value.trim();
      if (query.length > 0) {
        fetch(`/autocomplete_tags?query=${query}`)
          .then(response => response.json())
          .then(data => {
            tagSuggestions.innerHTML = '';
            if (data.length > 0) {
              data.forEach(suggestion => {
                const div = document.createElement('div');
                div.className = 'autocomplete-suggestion';
                div.textContent = suggestion;
                div.addEventListener('click', function() {
                  addTag(suggestion);
                  tagInput.value = '';
                  tagSuggestions.style.display = 'none';
                });
                tagSuggestions.appendChild(div);
              });
              tagSuggestions.style.display = 'block';
            } else {
              const div = document.createElement('div');
              div.className = 'autocomplete-suggestion';
              div.textContent = `Add "${query}"`;
              div.addEventListener('click', function() {
                addTag(query);
                tagInput.value = '';
                tagSuggestions.style.display = 'none';
              });
              tagSuggestions.appendChild(div);
              tagSuggestions.style.display = 'block';
            }
          });
      } else {
        tagSuggestions.style.display = 'none';
      }
    });

    document.addEventListener('click', function(e) {
      if (!tagInput.contains(e.target) && !tagSuggestions.contains(e.target)) {
        tagSuggestions.style.display = 'none';
      }
    });
  }
  // Initialize tag input if present (works on both add_poem and edit_poem pages)
  if (document.querySelector('#tag-input')) {
    let initialTags = window.initialTags || []; // Set window.initialTags in edit pages if needed.
    setupTagInput({
      inputSelector: '#tag-input',
      chipContainerSelector: '#tag-chips',
      suggestionSelector: '#tag-suggestions',
      hiddenInputSelector: '#tags-hidden',
      initialTags: initialTags
    });
  }

  /*===============================================
    3. Toggle New Collection Field (Add Poem Page)
  ===============================================*/
  const collectionSelect = document.getElementById('collection');
  if (collectionSelect) {
    collectionSelect.addEventListener('change', function() {
      const newCollectionField = document.getElementById('new-collection-field');
      newCollectionField.style.display = (this.value === 'new') ? 'block' : 'none';
    });
  }

  /*===============================================
    4. Discard Changes Modal
  ===============================================*/
  const discardBtn = document.getElementById('discardBtn');
  if (discardBtn) {
    discardBtn.addEventListener('click', function() {
      new bootstrap.Modal(document.getElementById('discardConfirmModal')).show();
    });
  }
  const confirmDiscardBtn = document.getElementById('confirmDiscardBtn');
  if (confirmDiscardBtn) {
    confirmDiscardBtn.addEventListener('click', function() {
      window.location.href = window.discardRedirectUrl || '/profile';
    });
  }

  /*===============================================
    5. Visibility Update Functions
  ===============================================*/
  window.updateCollectionVisibility = function(collectionId, newVisibility) {
    fetch(`/update_collection_visibility/${collectionId}`, {
      method: "POST",
      body: JSON.stringify({ visibility: newVisibility }),
      headers: { "Content-Type": "application/json" }
    })
      .then(response => response.json())
      .then(data => {
        if (data.status === "success") {
          console.log(`Collection ${collectionId} visibility updated to ${data.visibility}`);
        } else {
          alert("Error updating collection visibility: " + data.message);
        }
      })
      .catch(error => console.error("Error:", error));
  };

  window.updateCollectionVisibilityHandler = function(collectionId, selectElement) {
    const newValue = selectElement.value;
    if (newValue === "select_group") {
      window.currentCollectionId = collectionId;
      window.currentCollectionSelect = selectElement;
      new bootstrap.Modal(document.getElementById('selectGroupModal')).show();
    } else {
      window.updateCollectionVisibility(collectionId, newValue);
    }
  };

  window.updatePoemVisibility = function(poemId, newVisibility) {
    fetch(`/update_poem_visibility/${poemId}`, {
      method: "POST",
      body: JSON.stringify({ visibility: newVisibility }),
      headers: { "Content-Type": "application/json" }
    })
      .then(response => response.json())
      .then(data => {
        if (data.status === "success") {
          console.log(`Poem ${poemId} visibility updated to ${data.visibility}`);
        } else {
          alert("Error updating poem visibility: " + data.message);
        }
      })
      .catch(error => console.error("Error:", error));
  };

  window.updatePoemVisibilityHandler = function(poemId, selectElement) {
    const newValue = selectElement.value;
    if (newValue === "select_group") {
      window.currentPoemId = poemId;
      window.currentPoemSelect = selectElement;
      new bootstrap.Modal(document.getElementById('selectGroupModal')).show();
    } else {
      window.updatePoemVisibility(poemId, newValue);
    }
  };

  // Use event delegation for the select group confirm button
document.addEventListener('click', function(e) {
  if (e.target && e.target.id === 'selectGroupBtn') {
    const selectedRadio = document.querySelector('input[name="selectedGroup"]:checked');
    if (!selectedRadio) {
      alert("Please select a group.");
      return;
    }
    const groupId = selectedRadio.value;
    const groupName = selectedRadio.nextElementSibling.textContent.trim();
    const newVisibility = "select_group:" + groupId;
    function updateSelectElement(selectElement, updateVisibility) {
      let optionExists = false;
      for (let i = 0; i < selectElement.options.length; i++) {
        if (selectElement.options[i].value === updateVisibility) {
          optionExists = true;
          break;
        }
      }
      if (!optionExists) {
        const newOption = document.createElement("option");
        newOption.value = updateVisibility;
        newOption.text = groupName;
        selectElement.appendChild(newOption);
      }
      selectElement.value = updateVisibility;
    }
    if (window.currentCollectionSelect) {
      updateSelectElement(window.currentCollectionSelect, newVisibility);
      window.updateCollectionVisibility(window.currentCollectionId, newVisibility);
      window.currentCollectionId = null;
      window.currentCollectionSelect = null;
    }
    if (window.currentPoemSelect) {
      updateSelectElement(window.currentPoemSelect, newVisibility);
      window.updatePoemVisibility(window.currentPoemId, newVisibility);
      window.currentPoemId = null;
      window.currentPoemSelect = null;
    }
    const modalEl = document.getElementById('selectGroupModal');
    const modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) modalInstance.hide();
  }
});


  /*===============================================
    6. Global Delete Handling for Collections and Poems
  ===============================================*/
  // (Different pages may have separate delete modals; here we handle deletion via dedicated modals.)
  let collectionIdToDelete = null;
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (this.dataset.type === "collection") {
        collectionIdToDelete = this.dataset.id;
        new bootstrap.Modal(document.getElementById('deleteCollectionModal')).show();
      } else if (this.dataset.type === "poem") {
        window.poemIdToDelete = this.dataset.id;
        window.poemNameToDelete = this.dataset.name;
        const deletePoemNameElem = document.getElementById('deletePoemName');
        if (deletePoemNameElem) deletePoemNameElem.innerText = window.poemNameToDelete;
        new bootstrap.Modal(document.getElementById('deletePoemModal')).show();
      }
    });
  });

  const confirmDeleteCollectionBtn = document.getElementById('confirmDeleteCollectionBtn');
  if (confirmDeleteCollectionBtn) {
    confirmDeleteCollectionBtn.addEventListener('click', function() {
      if (collectionIdToDelete) {
        const formData = new FormData();
        formData.append("collection_id", collectionIdToDelete);
        fetch("/delete_collection", { method: "POST", body: formData })
          .then(response => response.json())
          .then(data => {
            if (data.status === "success") {
              window.location.href = "/profile";
            } else {
              alert("Error: " + data.message);
            }
          })
          .catch(error => console.error("Error:", error));
      }
    });
  }

  const confirmDeletePoemBtn = document.getElementById('confirmDeletePoemBtn');
  if (confirmDeletePoemBtn) {
    confirmDeletePoemBtn.addEventListener('click', function() {
      if (window.poemIdToDelete) {
        const formData = new FormData();
        formData.append("poem_id", window.poemIdToDelete);
        fetch("/delete_poem", { method: "POST", body: formData })
          .then(response => response.json())
          .then(data => {
            if (data.status === "success") {
              const modalEl = document.getElementById('deletePoemModal');
              let modalInstance = bootstrap.Modal.getInstance(modalEl);
              if (modalInstance) modalInstance.hide();
              location.reload();
            } else {
              alert("Error: " + data.message);
            }
          })
          .catch(error => console.error("Error:", error));
      }
    });
  }

  /*===============================================
    7. Comment Handling (Add & Delete)
  ===============================================*/
  // Comment addition for all pages using .add-comment-form
  document.querySelectorAll('.add-comment-form').forEach(form => {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const poemId = this.dataset.poemId;
      const commentInput = this.querySelector('input[name="comment"]');
      const commentText = commentInput.value.trim();
      if (commentText === "") return;
      console.log("Emitting send_comment for poemId:", poemId, "Comment:", commentText);
      // Capture a reference to the form for later use in the callback
      const currentForm = form;
      socket.emit('send_comment', { poemId: poemId, comment: commentText }, function(response) {
        console.log("Received send_comment response:", response);
        if (response.status === "success") {
          // Clear the input field only.
          commentInput.value = "";
        } else {
          alert("Error: " + response.message);
        }
      });
      
    });
  });

  socket.on('new_comment', function(data) {
    console.log("Received new_comment event:", data);
    
    // Prevent duplicate insertion if the comment already exists
    if (document.getElementById('comment-' + data.comment_id)) {
      console.log("Comment", data.comment_id, "already exists. Skipping duplicate.");
      return;
    }
  
    // Determine which comments list should be updated. Adjust selector as needed.
    const commentsList = document.querySelector(`.comments-list[data-poem-id="${data.poemId}"]`);
    if (commentsList) {
      let profileImageHtml = data.profile_image 
        ? `<img src="${data.profile_image}" alt="Profile" class="comment-profile-img">`
        : `<div class="rounded-circle bg-secondary d-flex justify-content-center align-items-center comment-profile-img">
             <span class="text-white">?</span>
           </div>`;
      const newComment = document.createElement("p");
      newComment.classList.add("small", "d-flex", "align-items-start");
      newComment.id = 'comment-' + data.comment_id;
      newComment.innerHTML = `
        ${profileImageHtml}
        <strong class="me-1">${data.username}</strong>: ${data.comment_text}
        <button class="btn btn-link btn-sm delete-comment" data-comment-id="${data.comment_id}">Delete</button>
      `;
      commentsList.insertBefore(newComment, commentsList.firstChild);
      // Optionally, scroll the container (if desired)
      commentsList.scrollTop = 0;
    }
  });
  
  
  // Comment deletion via event delegation
  document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('delete-comment')) {
      e.preventDefault();
      const commentId = e.target.dataset.commentId;
      console.log("Emitting delete_comment for commentId:", commentId);
      socket.emit('delete_comment', { comment_id: commentId }, function(response) {
        console.log("Received delete_comment response:", response);
        if (response.status !== 'success') {
          alert("Error: " + response.message);
        }
      });
    }
  });
  

  // Attach event listener to all view-comments buttons (for pages like user_profile.html)
document.querySelectorAll('.view-comments-btn').forEach(button => {
  button.addEventListener('click', function () {
    const poemId = this.dataset.poemId;
    const commentsContainer = document.getElementById('commentsContainer');
    if (commentsContainer) {
      commentsContainer.innerHTML = "<p class='text-muted'>Loading comments...</p>";
      fetch(`/get_comments/${poemId}`)
        .then(response => response.json())
        .then(data => {
          commentsContainer.innerHTML = "";
          if (data.length === 0) {
            commentsContainer.innerHTML = "<p class='text-muted'>No comments yet.</p>";
            return;
          }
          data.forEach(comment => {
            const commentElement = document.createElement("div");
            commentElement.classList.add("d-flex", "align-items-start", "mb-2");
            commentElement.innerHTML = `
              <img src="${comment.profile_image || '/static/default-profile.png'}" 
                   alt="Profile Image" class="rounded-circle me-2" style="width: 30px; height: 30px; object-fit: cover;">
              <div>
                <strong>${comment.username}</strong>
                <p class="mb-0">${comment.text}</p>
                <small class="text-muted">${comment.created_at}</small>
              </div>
            `;
            commentsContainer.appendChild(commentElement);
          });
        })
        .catch(error => {
          console.error("Error fetching comments:", error);
          commentsContainer.innerHTML = "<p class='text-danger'>Failed to load comments.</p>";
        });
    }
  });
});
// If we are on the explore page, join each poem room to receive comment updates in real time.
if (window.location.pathname === '/explore') {
  document.querySelectorAll('.list-group-item[data-poem-id]').forEach(item => {
    const poemId = item.getAttribute('data-poem-id');
    console.log("Joining poem room for poemId:", poemId);
    socket.emit('join_poem', { poemId: poemId });
  });
}
socket.on('comment_deleted', function(data) {
  console.log("Received comment_deleted event:", data);
  const commentElem = document.getElementById('comment-' + data.comment_id);
  if (commentElem) {
    commentElem.remove();
  }
});



  /*===============================================
    8. Favorite Button Toggle Handling
  ===============================================*/
  document.querySelectorAll('.favorite-btn').forEach(button => {
    button.addEventListener('click', function() {
      const poemId = this.dataset.poemId;
      fetch(`/toggle_favorite/${poemId}`, { method: "POST" })
        .then(response => response.json())
        .then(data => {
          if (data.status === "success") {
            const starIcon = this.querySelector('.star-icon');
            if (data.favorited) {
              starIcon.classList.remove("text-secondary");
              starIcon.classList.add("text-warning");
            } else {
              starIcon.classList.remove("text-warning");
              starIcon.classList.add("text-secondary");
            }
          } else {
            alert("Error: " + data.message);
          }
        })
        .catch(error => console.error("Error:", error));
    });
  });

  /*===============================================
    9. Filter Functionality for Explore/Favorites Pages
  ===============================================*/
  function setupFilterFunctionality({ inputSelector, chipContainerSelector, suggestionSelector, hiddenInputSelector, applyButtonSelector }) {
    const filterInput = document.querySelector(inputSelector);
    const filterChipsContainer = document.querySelector(chipContainerSelector);
    const filterSuggestions = document.querySelector(suggestionSelector);
    const filterHidden = document.querySelector(hiddenInputSelector);
    const applyButton = document.querySelector(applyButtonSelector);
    if (!filterInput || !filterChipsContainer || !filterSuggestions || !filterHidden || !applyButton) return;
    let filterTags = [];
    function updateHiddenInput() {
      filterHidden.value = filterTags.join(',');
    }
    function createFilterChip(tag) {
      const chip = document.createElement('span');
      chip.className = 'tag-chip-filter';
      chip.textContent = tag;
      const removeBtn = document.createElement('span');
      removeBtn.className = 'remove-tag';
      removeBtn.textContent = 'x';
      removeBtn.onclick = function() {
        filterChipsContainer.removeChild(chip);
        filterTags = filterTags.filter(t => t !== tag);
        updateHiddenInput();
      };
      chip.appendChild(removeBtn);
      return chip;
    }
    function addFilterTag(tag) {
      if (tag && !filterTags.includes(tag)) {
        filterTags.push(tag);
        const chip = createFilterChip(tag);
        filterChipsContainer.appendChild(chip);
        updateHiddenInput();
      }
    }
    filterInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const tag = filterInput.value.trim();
        if (tag !== '') {
          addFilterTag(tag);
          filterInput.value = '';
          filterSuggestions.style.display = 'none';
        }
      }
    });
    filterInput.addEventListener('input', function() {
      const query = filterInput.value.trim();
      if (query.length > 0) {
        fetch(`/autocomplete_tags?query=${query}`)
          .then(response => response.json())
          .then(data => {
            filterSuggestions.innerHTML = '';
            if (data.length > 0) {
              data.forEach(suggestion => {
                const div = document.createElement('div');
                div.className = 'autocomplete-suggestion';
                div.textContent = suggestion;
                div.addEventListener('click', function() {
                  addFilterTag(suggestion);
                  filterInput.value = '';
                  filterSuggestions.style.display = 'none';
                });
                filterSuggestions.appendChild(div);
              });
              filterSuggestions.style.display = 'block';
            } else {
              const div = document.createElement('div');
              div.className = 'autocomplete-suggestion';
              div.textContent = `Add "${query}"`;
              div.addEventListener('click', function() {
                addFilterTag(query);
                filterInput.value = '';
                filterSuggestions.style.display = 'none';
              });
              filterSuggestions.appendChild(div);
              filterSuggestions.style.display = 'block';
            }
          });
      } else {
        filterSuggestions.style.display = 'none';
      }
    });
    document.addEventListener('click', function(e) {
      if (!filterInput.contains(e.target) && !filterSuggestions.contains(e.target)) {
        filterSuggestions.style.display = 'none';
      }
    });
    applyButton.addEventListener('click', function() {
      const filterQuery = filterTags.join(',');
      const url = new URL(window.location.href);
      if (filterQuery) {
        url.searchParams.set('filter_tags', filterQuery);
      } else {
        url.searchParams.delete('filter_tags');
      }
      window.location.href = url.toString();
    });
    // Prepopulate filter chips from URL if present
    window.addEventListener('load', function() {
      const urlParams = new URLSearchParams(window.location.search);
      const filterTagsParam = urlParams.get('filter_tags');
      if (filterTagsParam) {
        const tagsFromURL = filterTagsParam.split(',').map(t => t.trim()).filter(t => t);
        tagsFromURL.forEach(tag => { addFilterTag(tag); });
      }
    });
  }
  if (document.getElementById('filterTagInput')) {
    setupFilterFunctionality({
      inputSelector: '#filterTagInput',
      chipContainerSelector: '#filter-tag-chips',
      suggestionSelector: '#filter-tag-suggestions',
      hiddenInputSelector: '#filterTagsHidden',
      applyButtonSelector: '#applyTagFilterBtn'
    });
  }
  // Populate filter dropdown with unique poem types if applicable
  const filterSelect = document.getElementById('filterType');
  if (filterSelect) {
    const poemCards = document.querySelectorAll('#poemList .list-group-item.custom-bg');
    const typesSet = new Set();
    poemCards.forEach(card => {
      const type = card.getAttribute('data-poem-type');
      if (type && type.trim() !== "") typesSet.add(type);
    });
    Array.from(typesSet).sort().forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      filterSelect.appendChild(option);
    });
    function updateDisplay() {
      const selectedFilter = filterSelect.value;
      const sortBy = document.getElementById('sortBy') ? document.getElementById('sortBy').value : 'most_interacted';
      let cardsArray = Array.from(poemCards);
      cardsArray.forEach(card => {
        const type = card.getAttribute('data-poem-type');
        card.style.display = (selectedFilter === "all" || type === selectedFilter) ? "" : "none";
      });
      const visibleCards = cardsArray.filter(card => card.style.display !== "none");
      visibleCards.sort((a, b) => {
        if (sortBy === "most_interacted") {
          return parseInt(b.getAttribute('data-comments')) - parseInt(a.getAttribute('data-comments'));
        } else if (sortBy === "old_to_new") {
          return parseInt(a.getAttribute('data-poem-id')) - parseInt(b.getAttribute('data-poem-id'));
        } else if (sortBy === "new_to_old") {
          return parseInt(b.getAttribute('data-poem-id')) - parseInt(a.getAttribute('data-poem-id'));
        }
      });
      const poemList = document.getElementById('poemList');
      visibleCards.forEach(card => poemList.appendChild(card));
    }
    filterSelect.addEventListener('change', updateDisplay);
    const sortSelect = document.getElementById('sortBy');
    if (sortSelect) sortSelect.addEventListener('change', updateDisplay);
  }

  /*===============================================
    10. Profile-Specific Functionalities
  ===============================================*/
  // Edit Description
  const editDescriptionForm = document.getElementById('editDescriptionForm');
  if (editDescriptionForm) {
    editDescriptionForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const newDesc = document.getElementById('descriptionInput').value;
      updateDescription(newDesc);
      const modalEl = document.getElementById('editDescriptionModal');
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();
    });
  }
  function updateDescription(newDescription) {
    const formData = new FormData();
    formData.append("description", newDescription);
    fetch("/update_description", { method: "POST", body: formData })
      .then(response => response.json())
      .then(data => {
        if (data.status === "success") {
          const userDescElem = document.getElementById('user-description');
          if (userDescElem) {
            userDescElem.innerHTML = data.description ? data.description : "<em>add description ...</em>";
          }
        } else {
          alert("Error updating description: " + data.message);
        }
      })
      .catch(error => console.error("Error:", error));
  }
  // Edit Profile Image
  const editProfileImageForm = document.getElementById('editProfileImageForm');
  if (editProfileImageForm) {
    editProfileImageForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const formData = new FormData(this);
      updateProfileImage(formData);
      const modalEl = document.getElementById('editProfileImageModal');
      const modalInstance = bootstrap.Modal.getInstance(modalEl);
      if (modalInstance) modalInstance.hide();
    });
  }
  function updateProfileImage(formData) {
    fetch("/update_profile_image", { method: "POST", body: formData })
      .then(response => response.json())
      .then(data => {
        if (data.status === "success") {
          const imgElem = document.querySelector("#profileImage");
          if (imgElem) imgElem.src = data.profile_image;
        } else {
          alert("Error updating profile image: " + data.message);
        }
      })
      .catch(error => console.error("Error:", error));
  }
  // New Collection Form submission
  const newCollectionForm = document.getElementById('newCollectionForm');
  if (newCollectionForm) {
    newCollectionForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const formData = new FormData(newCollectionForm);
      fetch("/create_collection", { method: "POST", body: formData })
        .then(response => response.json())
        .then(data => {
          if (data.status === "success") {
            const flashDiv = document.getElementById('flash-message');
            if (flashDiv) {
              flashDiv.innerHTML = `<div class="alert alert-success" role="alert">${data.message}</div>`;
            }
            const modalEl = document.getElementById('newCollectionModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            setTimeout(() => { location.reload(); }, 1500);
          } else {
            const flashDiv = document.getElementById('flash-message');
            if (flashDiv) {
              flashDiv.innerHTML = `<div class="alert alert-danger" role="alert">Error: ${data.message}</div>`;
            }
          }
        })
        .catch(error => console.error("Error:", error));
    });
  }
  // Global Delete Modal (if used in base.html)
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', function() {
      let url = "";
      let formData = new FormData();
      // Variables deleteType and deleteId should be set by the delete button click events (if used)
      if (window.deleteType === 'poem') {
        url = '/delete_poem';
        formData.append('poem_id', window.deleteId);
      } else if (window.deleteType === 'collection') {
        url = '/delete_collection';
        formData.append('collection_id', window.deleteId);
      }
      fetch(url, { method: 'POST', body: formData })
        .then(response => response.json())
        .then(data => {
          if (data.status === 'success') {
            window.location.href = '/profile';
          } else {
            alert("Error: " + data.message);
          }
        })
        .catch(error => console.error("Error:", error));
    });
  }

  /*===============================================
    11. Chat Functionality (from chats.html)
  ===============================================*/
  // Define loadChatGroup globally so inline onclick attributes can access it.
  window.loadChatGroup = function(groupId, groupName) {
      // Ensure groupId and groupName are defined
  if (typeof groupId === 'undefined' || groupId === null) {
    console.error("Error: groupId is not defined!");
    return;
  }
  console.log("Loading chat group with ID:", groupId, "and name:", groupName);

    fetch(`/get_messages/${groupId}`)
      .then(response => response.json())
      .then(data => {
        const chatArea = document.getElementById('chatArea');
        chatArea.setAttribute('data-group-id', groupId);
        let html = `<h3>${groupName}</h3>`;
        html += `<div id="messagesContainer" style="height:400px; overflow-y:scroll; border:1px solid #ccc; padding:10px;">`;
        if (data.length === 0) {
          html += `<p>No messages yet.</p>`;
        } else {
          let lastSender = null;
          data.forEach(msg => {
            if (msg.is_system) {
              html += `<div class="text-center text-muted mb-2" style="font-style: italic;">${msg.content}</div>`;
            } else if (msg.sender === window.currentUsername) {
              if (lastSender !== window.currentUsername) {
                html += `
                  <div class="d-flex justify-content-end mb-2">
                    <div>
                      <div class="chat-bubble user-message">
                        ${msg.content}
                      </div>
                    </div>
                  </div>
                `;
              } else {
                html += `
                  <div class="d-flex justify-content-end mb-2">
                    <div class="ms-5">
                      <div class="chat-bubble user-message">
                        ${msg.content}
                      </div>
                    </div>
                  </div>
                `;
              }
            } else {
              const profilePic = msg.sender_profile ? msg.sender_profile : '/static/default-profile.png';
              if (msg.sender !== lastSender) {
                html += `
                  <div class="d-flex mb-2" style="align-items: flex-start;">
                    <div style="margin-right: 8px; margin-top: 8px;">
                      <img src="${profilePic}" alt="Profile" class="rounded-circle" style="width:40px; height:40px; object-fit:cover;">
                    </div>
                    <div>
                      <div style="font-size: 0.8rem; color:#555; margin-bottom:2px;">${msg.sender}</div>
                      <div class="chat-bubble other-message">
                        ${msg.content}
                      </div>
                    </div>
                  </div>
                `;
              } else {
                html += `
                  <div class="ms-5 mb-2">
                    <div class="chat-bubble other-message">
                      ${msg.content}
                    </div>
                  </div>
                `;
              }
            }
            lastSender = msg.sender;
          });
        }
        html += `</div>`;  // End messagesContainer
        // Message form
        html += `
          <form id="sendMessageForm">
            <div class="input-group mt-2">
              <input type="text" class="form-control" id="messageInput" placeholder="Type your message">
              <button type="submit" class="btn btn-primary prf-add-new">Send</button>
            </div>
          </form>
        `;
        // Group Details section
        html += `
          <div class="mt-3">
            <button class="btn btn-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#groupDetails" aria-expanded="false" aria-controls="groupDetails">
              Details
            </button>
            <div class="collapse" id="groupDetails">
              <div class="card card-body mt-2">
                <div class="mb-2">
                  <strong>Group Name:</strong>
                  <span id="groupNameDisplay"></span>
                  <button class="btn btn-link btn-sm" id="openEditGroupNameBtn">Edit</button>
                </div>
                <div class="mb-2">
                  <strong>Created:</strong>
                  <span id="groupCreatedDisplay"></span>
                </div>
                <div class="mb-2">
                  <strong>Group Members:</strong>
                  <ul id="groupMembersList" class="list-group"></ul>
                  <button class="btn btn-link btn-sm" id="openEditGroupMembersBtn">Edit Members</button>
                </div>
              </div>
            </div>
          </div>
        `;
        chatArea.innerHTML = html;
        const messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        socket.emit('join', { groupId: groupId }, function(response) {
          console.log('Joined room:', response);
        });

        // Attach event listener for "Edit Group Name" button
        const editNameBtn = document.getElementById('openEditGroupNameBtn');
        if (editNameBtn) {
          editNameBtn.addEventListener('click', function() {
            var modal = new bootstrap.Modal(document.getElementById('editGroupNameModal'));
            // Set the input field to the current group name
            document.getElementById('newGroupName').value = window.currentGroup ? window.currentGroup.name : '';
            modal.show();
          });
        }

        // Attach event listener for "Edit Group Members" button
        const editMembersBtn = document.getElementById('openEditGroupMembersBtn');
        if (editMembersBtn) {
          editMembersBtn.addEventListener('click', function() {
            var modal = new bootstrap.Modal(document.getElementById('editGroupMembersModal'));
            const container = document.getElementById('membersCheckboxes');
            container.innerHTML = "";
            // Populate checkboxes based on availableUsers and current group members.
            if (window.availableUsers && window.currentGroup && window.currentGroup.members) {
              window.availableUsers.forEach(user => {
                const isMember = window.currentGroup.members.some(m => m.id === user.id);
                const div = document.createElement('div');
                div.className = "form-check";
                div.innerHTML = `
                  <input class="form-check-input" type="checkbox" name="members" id="modal_user_${user.id}" value="${user.id}" ${isMember ? "checked" : ""}>
                  <label class="form-check-label" for="modal_user_${user.id}">${user.username}</label>
                `;
                container.appendChild(div);
              });
            }
            modal.show();
          });
        }



        document.getElementById('sendMessageForm').addEventListener('submit', function(e) {
          e.preventDefault();
          const messageInput = document.getElementById('messageInput');
          const message = messageInput.value.trim();
          if (!message) return;
          console.log("Sending message to groupId:", groupId, "Message:", message);
          socket.emit('send_message', { groupId: groupId, message: message });
          // Immediately stop typing when a message is sent:
          socket.emit('stop_typing', { groupId: groupId });
          messageInput.value = '';
        });
        

        // Typing indicator: emit "typing" and "stop_typing" events
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
          let typingTimeout;
          messageInput.addEventListener('input', function() {
            // Emit "typing" event whenever the user types
            socket.emit('typing', { groupId: groupId, sender: window.currentUsername });
            // Clear any existing timeout and set a new one
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(function() {
              socket.emit('stop_typing', { groupId: groupId });
            }, 3000); // 3 seconds of inactivity stops the indicator
          });
        }

        
        
        // Update group details
        fetch(`/get_group_details/${groupId}`)
          .then(resp => resp.json())
          .then(detailsData => {
            if (detailsData.status === 'success') {
              window.currentGroup = detailsData.group;
              updateGroupDetails(window.currentGroup);
            } else {
              alert("Error: " + detailsData.message);
            }
          });
        // Scroll to bottom
        if (messagesContainer) {
          messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
          // If a typing indicator exists, move it to the bottom of the container:
          const typingIndicator = document.getElementById('typingIndicator');
          if (typingIndicator) {
            messagesContainer.appendChild(typingIndicator);
          }
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }                    
        // Attach event listeners for editing group details
        document.getElementById('openEditGroupNameBtn').addEventListener('click', function() {
          var modal = new bootstrap.Modal(document.getElementById('editGroupNameModal'));
          document.getElementById('newGroupName').value = window.currentGroup.name;
          modal.show();
        });
        document.getElementById('openEditGroupMembersBtn').addEventListener('click', function() {
          var modal = new bootstrap.Modal(document.getElementById('editGroupMembersModal'));
          const container = document.getElementById('membersCheckboxes');
          container.innerHTML = "";
          window.availableUsers.forEach(user => {
            const isMember = window.currentGroup.members.some(m => m.id === user.id);
            const div = document.createElement('div');
            div.className = "form-check";
            div.innerHTML = `
              <input class="form-check-input" type="checkbox" name="members" id="modal_user_${user.id}" value="${user.id}" ${isMember ? "checked" : ""}>
              <label class="form-check-label" for="modal_user_${user.id}">${user.username}</label>
            `;
            container.appendChild(div);
          });
          modal.show();
        });
      })
      .catch(error => console.error("Error loading messages:", error));
  };

  // Leave Group Handling
  document.querySelectorAll('.leave-group-btn').forEach(button => {
    button.addEventListener('click', function(e) {
      e.stopPropagation();
      window.leaveGroupId = this.getAttribute('data-group-id');
      window.leaveGroupName = this.getAttribute('data-group-name');
      new bootstrap.Modal(document.getElementById('leaveGroupModal')).show();
    });
  });
  document.getElementById('confirmLeaveGroupBtn').addEventListener('click', function() {
    fetch(`/leave_group/${window.leaveGroupId}`, { method: 'POST' })
      .then(response => response.json())
      .then(data => {
        if (data.status === 'success') {
          const groupItem = document.querySelector(`.chat-group-item[data-group-id="${window.leaveGroupId}"]`);
          if (groupItem) groupItem.remove();
          const chatArea = document.getElementById('chatArea');
          if (chatArea.getAttribute('data-group-id') === window.leaveGroupId) {
            chatArea.innerHTML = `<h3>Select a chat group to view messages</h3><p>Click on a group from the list on the left.</p>`;
          }
          showFlashMessage(`Successfully left group ${window.leaveGroupName}`, "success");
          const leaveModalEl = document.getElementById('leaveGroupModal');
          const leaveModal = bootstrap.Modal.getInstance(leaveModalEl);
          if (leaveModal) leaveModal.hide();
        } else {
          alert("Error leaving group: " + data.message);
        }
      })
      .catch(err => console.error("Error leaving group:", err));
  });
  function showFlashMessage(message, category) {
    const flashDiv = document.getElementById('flashMessage');
    flashDiv.innerHTML = `<div class="alert alert-${category}" role="alert">${message}</div>`;
    setTimeout(() => { flashDiv.innerHTML = ""; }, 3000);
  }
  function updateGroupDetails(group) {
    document.getElementById('groupNameDisplay').textContent = group.name;
    document.getElementById('groupCreatedDisplay').textContent = group.created_at;
    const membersList = document.getElementById('groupMembersList');
    membersList.innerHTML = "";
    if (group.members && group.members.length > 0) {
      group.members.forEach(member => {
        const li = document.createElement('li');
        li.className = "list-group-item";
        li.textContent = member.username;
        li.setAttribute('data-user-id', member.id);
        membersList.appendChild(li);
      });
    } else {
      membersList.innerHTML = "<li class='list-group-item'>No members listed.</li>";
    }
  }
  // Edit Group Name Form
  document.getElementById('editGroupNameForm').addEventListener('submit', function(e) {
    e.preventDefault();
    console.log('Edit group name form submitted.');
    const newName = document.getElementById('newGroupName').value.trim();
    if (!newName) {
      alert("Group name cannot be empty.");
      return;
    }
    if (!window.currentGroup || !window.currentGroup.id) {
      console.error("window.currentGroup is undefined or missing id.");
      return;
    }
    console.log("Emitting update_group_name with groupId:", window.currentGroup.id, "and newName:", newName);
    socket.emit('update_group_name', { groupId: window.currentGroup.id, group_name: newName }, function(response) {
      console.log("Received update_group_name response:", response);
      if (response.status === 'success') {
        window.currentGroup.name = response.group_name;
        updateGroupDetails(window.currentGroup);
        const modalEl = document.getElementById('editGroupNameModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      } else {
        alert("Error: " + response.message);
      }
    });
  });
  
  
  // Edit Group Members Form
  document.getElementById('editGroupMembersForm').addEventListener('submit', function(e) {
    e.preventDefault();
    console.log('Edit group members form submitted.');
    const memberCheckboxes = document.querySelectorAll('#membersCheckboxes input[name="members"]:checked');
    const memberIds = Array.from(memberCheckboxes).map(chk => chk.value);
    if (!window.currentGroup || !window.currentGroup.id) {
      console.error("window.currentGroup is undefined or missing id.");
      return;
    }
    console.log("Emitting update_group_members with groupId:", window.currentGroup.id, "and memberIds:", memberIds);
    socket.emit('update_group_members', { groupId: window.currentGroup.id, members: memberIds }, function(response) {
      console.log("Received update_group_members response:", response);
      if (response.status === 'success') {
        window.currentGroup.members = response.members;
        updateGroupDetails(window.currentGroup);
        const modalEl = document.getElementById('editGroupMembersModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      } else {
        alert("Error: " + response.message);
      }
    });
  });
  
  socket.on('group_updated', function(data) {
    console.log("Received group_updated event:", data);
    if (data.groupId && data.name) {
      // Update the left-side chat group list
      const groupItems = document.querySelectorAll('.chat-group-item');
      groupItems.forEach(item => {
        if (item.getAttribute('data-group-id') === String(data.groupId)) {
          // Update the visible group name
          const groupNameSpan = item.querySelector('.group-name');
          if (groupNameSpan) {
            groupNameSpan.textContent = data.name;
            // Update the onclick attribute for loadChatGroup with the new name
            groupNameSpan.setAttribute('onclick', `window.loadChatGroup(${data.groupId}, '${data.name}')`);
          }
          // Update data attributes for consistency
          item.setAttribute('data-group-name', data.name);
          const leaveButton = item.querySelector('.leave-group-btn');
          if (leaveButton) {
            leaveButton.setAttribute('data-group-name', data.name);
          }
        }
      });
    }
  });
  
  
const lastSenderMap = {};  // Key: groupId, Value: last sender's username

socket.on('new_message', function(data) {
  console.log("Received new_message event:", data);
  const chatArea = document.getElementById('chatArea');
  if (!chatArea) return; // no chat area
  const currentGroupId = chatArea.getAttribute('data-group-id');
  if (String(data.groupId) !== String(currentGroupId)) return; // different room

  // Retrieve the last sender for this room
  let lastSender = lastSenderMap[currentGroupId] || null;

  // Build the new message's HTML
  let messageHtml = '';
  if (data.is_system) {
    messageHtml = `<div class="text-center text-muted mb-2" style="font-style: italic;">${data.message}</div>`;
  } else if (data.sender === window.currentUsername) {
    if (lastSender !== data.sender) {
      // first message in a consecutive batch from current user
      messageHtml = `
        <div class="d-flex justify-content-end mb-2">
          <div>
            <div class="chat-bubble user-message">
              ${data.message}
            </div>
          </div>
        </div>
      `;
    } else {
      // consecutive message from same user
      messageHtml = `
        <div class="d-flex justify-content-end mb-2">
          <div class="ms-5">
            <div class="chat-bubble user-message">
              ${data.message}
            </div>
          </div>
        </div>
      `;
    }
  } else {
    // Another user's message
    const profilePic = data.sender_profile || '/static/default-profile.png';
    if (data.sender !== lastSender) {
      // new sender
      messageHtml = `
        <div class="d-flex mb-2" style="align-items: flex-start;">
          <div style="margin-right: 8px; margin-top: 8px;">
            <img src="${profilePic}" alt="Profile" class="rounded-circle" style="width:40px; height:40px; object-fit:cover;">
          </div>
          <div>
            <div style="font-size: 0.8rem; color:#555; margin-bottom:2px;">${data.sender}</div>
            <div class="chat-bubble other-message">
              ${data.message}
            </div>
          </div>
        </div>
      `;
    } else {
      // consecutive message from same user
      messageHtml = `
        <div class="ms-5 mb-2">
          <div class="chat-bubble other-message">
            ${data.message}
          </div>
        </div>
      `;
    }
  }

  // Insert the new HTML
  const messagesContainer = document.getElementById('messagesContainer');
  if (messagesContainer) {
    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Update the last sender for this group
  lastSenderMap[currentGroupId] = data.sender;
});

socket.on('typing', function(data) {
  console.log("Received typing event:", data);
  const chatArea = document.getElementById('chatArea');
  const currentGroupId = chatArea.getAttribute('data-group-id');
  if (String(data.groupId) === String(currentGroupId) && data.sender !== window.currentUsername) {
    const messagesContainer = document.getElementById('messagesContainer');
    // Check if the user is already at (or near) the bottom of the messages container
    const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 20;
    
    let typingIndicator = document.getElementById('typingIndicator');
    if (!typingIndicator) {
      typingIndicator = document.createElement('div');
      typingIndicator.id = 'typingIndicator';
      typingIndicator.style.fontStyle = 'italic';
      typingIndicator.style.color = '#999';
      typingIndicator.textContent = `${data.sender} typing...`;
      messagesContainer.insertAdjacentElement('beforeend', typingIndicator);
    }
    // If the user was already at the bottom, scroll down to show the typing indicator
    if (isAtBottom) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
});


socket.on('stop_typing', function(data) {
  console.log("Received stop_typing event:", data);
  const chatArea = document.getElementById('chatArea');
  const currentGroupId = chatArea.getAttribute('data-group-id');
  if (String(data.groupId) === String(currentGroupId)) {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }
});
  
  /*===============================================
    12. End of Chat Functionality
  ===============================================*/

}); // End DOMContentLoaded
