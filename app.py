from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, login_user, login_required, logout_user, current_user, UserMixin
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

load_dotenv()
app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret_key'  # Use a secure key in production
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
migrate = Migrate(app, db)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message = "Please log in to access this page."

UPLOAD_FOLDER = 'static/uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# Many-to-Many relationship for favorite poems
favorites = db.Table('favorites',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('poem_id', db.Integer, db.ForeignKey('poem.id'), primary_key=True)
)

# Association table for Poem and Tag
poem_tags = db.Table('poem_tags',
    db.Column('poem_id', db.Integer, db.ForeignKey('poem.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), primary_key=True)
)

# Self-referential many-to-many table for following relationships
followers = db.Table('followers',
    db.Column('follower_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('followed_id', db.Integer, db.ForeignKey('user.id'), primary_key=True)
)

# Association table for chat group members
chat_group_members = db.Table('chat_group_members',
    db.Column('group_id', db.Integer, db.ForeignKey('chat_group.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True)
)

# Relationship for following other users
following = db.relationship('User', secondary=followers,
                            primaryjoin=(followers.c.follower_id == id),
                            secondaryjoin=(followers.c.followed_id == id),
                            backref=db.backref('followers', lazy='dynamic'),
                            lazy='dynamic')


# MODELS
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    profile_image = db.Column(db.String(300), nullable=True)
    poems = db.relationship('Poem', backref='author', lazy=True)
    collections = db.relationship('Collection', backref='owner', lazy=True)
    favorite_poems = db.relationship('Poem', secondary=favorites, backref=db.backref('favorited_by', lazy='dynamic'))
    following = db.relationship('User', secondary=followers,
                                primaryjoin=(followers.c.follower_id == id),
                                secondaryjoin=(followers.c.followed_id == id),
                                backref=db.backref('followers', lazy='dynamic'),
                                lazy='dynamic')

class Poem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    poem_type = db.Column(db.String(100), nullable=True)
    rating = db.Column(db.Integer, default=0)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    collection_id = db.Column(db.Integer, db.ForeignKey('collection.id'), nullable=True)
    # New visibility field; default set to 'public'
    visibility = db.Column(db.String(10), nullable=False, default='public')
    comments = db.relationship('Comment', backref='poem', lazy=True, cascade="all, delete-orphan")
    tags = db.relationship('Tag', secondary=poem_tags, backref=db.backref('poems', lazy='dynamic'))
    # New field to associate a poem with a prompt (optional)
    prompt_id = db.Column(db.Integer, db.ForeignKey('prompt.id'), nullable=True)

class Collection(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    poems = db.relationship('Poem', backref='collection', lazy=True)
    # New visibility field; default set to 'public'
    visibility = db.Column(db.String(10), nullable=False, default='public')

class Prompt(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Relationship so we can access the creator’s details
    creator = db.relationship('User', backref='prompts', lazy=True)
    # All poems posted under this prompt
    poems = db.relationship('Poem', backref='prompt', lazy=True)

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(300), nullable=False)
    poem_id = db.Column(db.Integer, db.ForeignKey('poem.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    # New created_at timestamp for comments
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # New flag to indicate if this is an edit marker (divider)
    is_edit_marker = db.Column(db.Boolean, default=False)
    author = db.relationship('User', backref='comments')

class Tag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

class ChatGroup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Many-to-many relationship with users
    members = db.relationship('User', secondary=chat_group_members, backref=db.backref('chat_groups', lazy='dynamic'))
    messages = db.relationship('Message', backref='chat_group', lazy='dynamic')

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    group_id = db.Column(db.Integer, db.ForeignKey('chat_group.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    sender = db.relationship('User', backref='sent_messages')
    is_system = db.Column(db.Boolean, default=False)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# ROUTES

@app.route('/')
def home():
    return render_template('home.html')

# @app.route('/explore')
# def explore():
#     # ✅ Ensure only public poems are shown
#     poems = Poem.query.filter_by(visibility='public').all()
#     return render_template('explore.html', poems=poems)

@app.route('/explore')
def explore():
    filter_tags = request.args.get('filter_tags', '')
    poems_query = Poem.query.filter_by(visibility='public')
    
    if filter_tags:
        tag_list = [tag.strip().lower() for tag in filter_tags.split(',') if tag.strip()]
        if tag_list:
            # Join with Tag and filter poems that have any of the specified tags.
            poems_query = poems_query.join(Poem.tags).filter(Tag.name.in_(tag_list)).group_by(Poem.id)
    
    poems = poems_query.all()
    return render_template('explore.html', poems=poems)


@app.route('/profile')
@login_required
def profile():
    user = current_user
    return render_template('profile.html', user=user)

@app.route('/collection/<int:collection_id>')
@login_required
def collection(collection_id):
    collection_obj = Collection.query.get_or_404(collection_id)
    if collection_obj.owner != current_user:
        flash("You don't have access to that collection", "danger")
        return redirect(url_for('profile'))
    poems = Poem.query.filter_by(collection_id=collection_id).all()
    return render_template('collection.html', collection=collection_obj, poems=poems)

@app.route('/add_poem', methods=['GET', 'POST'])
@login_required
def add_poem():
    collections = Collection.query.filter_by(user_id=current_user.id).all()
    prompt_id = request.args.get('prompt')  # Get prompt from URL if provided
    if request.method == 'POST':
        title = request.form.get('title')
        content = request.form.get('content')
        poem_type = request.form.get('type')
        visibility = request.form.get('visibility') or 'public'
        collection_option = request.form.get('collection')
        new_collection_name = request.form.get('new_collection')

        poem = Poem(title=title, content=content, author=current_user, poem_type=poem_type, visibility=visibility)
        if collection_option == "none":
            pass
        elif collection_option == "new":
            if new_collection_name:
                coll_visibility = request.form.get('coll_visibility') or 'public'
                new_coll = Collection(name=new_collection_name, owner=current_user, visibility=coll_visibility)
                db.session.add(new_coll)
                db.session.commit()
                poem.collection = new_coll
            else:
                flash("Please provide a name for the new collection.", "danger")
                return redirect(url_for('add_poem'))
        else:
            coll = Collection.query.get(int(collection_option))
            if coll and coll.owner == current_user:
                poem.collection = coll
            else:
                flash("Invalid collection selection.", "danger")
                return redirect(url_for('add_poem'))

        # Process tags for new poem (existing code)...
        tags_str = request.form.get('tags')
        if tags_str:
            tag_list = [t.strip() for t in tags_str.split(',') if t.strip()]
            for tag_name in tag_list:
                tag_name_lower = tag_name.lower()
                tag_obj = Tag.query.filter_by(name=tag_name_lower).first()
                if not tag_obj:
                    tag_obj = Tag(name=tag_name_lower)
                    db.session.add(tag_obj)
                poem.tags.append(tag_obj)

        # Link the poem to the prompt if provided
        prompt_id_form = request.form.get('prompt_id')
        if prompt_id_form:
            poem.prompt_id = int(prompt_id_form)

        db.session.add(poem)
        db.session.commit()
        flash("Poem added successfully!", "success")
        return redirect(url_for('profile'))
    return render_template('add_poem.html', collections=collections, prompt_id=prompt_id)

@app.route('/edit_poem/<int:poem_id>', methods=['GET', 'POST'])
@login_required
def edit_poem(poem_id):
    poem = Poem.query.get_or_404(poem_id)
    if poem.author != current_user:
        flash("You are not allowed to edit this poem.", "danger")
        return redirect(url_for('profile'))
    if request.method == 'POST':
        poem.title = request.form.get('title')
        poem.content = request.form.get('content')
        poem.poem_type = request.form.get('type')
        poem.visibility = request.form.get('visibility') or 'public'
        tags_str = request.form.get('tags')
        poem.tags.clear()
        if tags_str:
            tag_list = [t.strip() for t in tags_str.split(',') if t.strip()]
            for tag_name in tag_list:
                tag_name_lower = tag_name.lower()
                tag_obj = Tag.query.filter_by(name=tag_name_lower).first()
                if not tag_obj:
                    tag_obj = Tag(name=tag_name_lower)
                    db.session.add(tag_obj)
                poem.tags.append(tag_obj)
        db.session.commit()
        # Convert UTC to EST (UTC-5)
        dt_est = datetime.utcnow() - timedelta(hours=5)
        marker_text = "Edits made on " + dt_est.strftime("%Y-%m-%d %H:%M:%S EST") + " NEW COMMENTS ABOVE"
        marker_comment = Comment(text=marker_text, poem=poem, user_id=current_user.id, is_edit_marker=True)
        db.session.add(marker_comment)
        db.session.commit()
        flash("Poem updated successfully!", "success")
        return redirect(url_for('profile'))
    return render_template('edit_poem.html', poem=poem)

@app.route('/create_collection', methods=['POST'])
@login_required
def create_collection():
    collection_name = request.form.get('collection_name')
    coll_visibility = request.form.get('visibility') or 'public'
    if not collection_name:
        return jsonify(status="error", message="Please provide a collection name."), 400
    if Collection.query.filter_by(name=collection_name, user_id=current_user.id).first():
        return jsonify(status="error", message="Collection already exists."), 400
    new_collection = Collection(name=collection_name, owner=current_user, visibility=coll_visibility)
    db.session.add(new_collection)
    db.session.commit()
    return jsonify(status="success", message="Collection created successfully!", collection_name=collection_name)

@app.route('/rate_poem', methods=['POST'])
@login_required
def rate_poem():
    try:
        poem_id = int(request.form.get('poem_id'))
        rating = int(request.form.get('rating'))
    except (ValueError, TypeError):
        return jsonify(status="error", message="Invalid data"), 400
    poem = Poem.query.get(poem_id)
    if not poem:
        return jsonify(status="error", message="Poem not found"), 404
    poem.rating = rating
    db.session.commit()
    return jsonify(status="success", message="Rating updated", rating=rating)

@app.route('/add_comment', methods=['POST'])
@login_required
def add_comment():
    try:
        poem_id = int(request.form.get('poem_id'))
    except (ValueError, TypeError):
        return jsonify(status="error", message="Invalid poem id"), 400

    comment_text = request.form.get('comment')
    if not comment_text:
        return jsonify(status="error", message="Empty comment"), 400

    poem = Poem.query.get(poem_id)
    if not poem:
        return jsonify(status="error", message="Poem not found"), 404

    comment = Comment(text=comment_text, poem=poem, user_id=current_user.id)
    db.session.add(comment)
    db.session.commit()

    return jsonify(
        status="success",
        comment_id=comment.id,
        comment_text=comment.text,
        username=current_user.username,  # ✅ Send back the username
        profile_image=current_user.profile_image if current_user.profile_image else None  # ✅ Send back the profile image
    )


@app.route('/delete_comment', methods=['POST'])
@login_required
def delete_comment():
    try:
        comment_id = int(request.form.get('comment_id'))
    except (ValueError, TypeError):
        return jsonify(status="error", message="Invalid comment id"), 400

    comment = Comment.query.get(comment_id)
    if not comment:
        return jsonify(status="error", message="Comment not found"), 404

    if comment.user_id != current_user.id:
        return jsonify(status="error", message="Not authorized to delete this comment"), 403

    db.session.delete(comment)
    db.session.commit()
    return jsonify(status="success", message="Comment deleted")

@app.route('/delete_poem', methods=['POST'])
@login_required
def delete_poem():
    try:
        poem_id = int(request.form.get('poem_id'))
    except Exception:
        return jsonify(status="error", message="Invalid poem id"), 400
    poem = Poem.query.get(poem_id)
    if not poem or poem.author != current_user:
        return jsonify(status="error", message="Poem not found or unauthorized"), 404
    db.session.delete(poem)
    db.session.commit()
    return jsonify(status="success", message="Poem deleted")

@app.route('/delete_collection', methods=['POST'])
@login_required
def delete_collection():
    try:
        collection_id = int(request.form.get('collection_id'))
    except Exception:
        return jsonify(status="error", message="Invalid collection id"), 400
    collection_obj = Collection.query.get(collection_id)
    if not collection_obj or collection_obj.owner != current_user:
        return jsonify(status="error", message="Collection not found or unauthorized"), 404
    # Delete all poems in the collection (their comments will be deleted automatically)
    for poem in collection_obj.poems:
        db.session.delete(poem)
    db.session.delete(collection_obj)
    db.session.commit()
    return jsonify(status="success", message="Collection and all its poems deleted")

@app.route('/update_poem_visibility/<int:poem_id>', methods=['POST'])
@login_required
def update_poem_visibility(poem_id):
    poem = Poem.query.get_or_404(poem_id)
    if poem.author != current_user:
        return jsonify(status="error", message="Unauthorized"), 403

    data = request.get_json()
    new_visibility = data.get("visibility")
    if new_visibility not in ["public", "private"]:
        return jsonify(status="error", message="Invalid visibility value"), 400

    # ✅ Actually update the database and commit the change
    poem.visibility = new_visibility
    db.session.commit()

    return jsonify(status="success", message="Poem visibility updated", visibility=poem.visibility)

@app.route('/update_collection_visibility/<int:collection_id>', methods=['POST'])
@login_required
def update_collection_visibility(collection_id):
    collection = Collection.query.get_or_404(collection_id)
    if collection.owner != current_user:
        return jsonify(status="error", message="Unauthorized"), 403

    data = request.get_json()
    new_visibility = data.get("visibility")
    if new_visibility not in ["public", "private"]:
        return jsonify(status="error", message="Invalid visibility value"), 400

    # ✅ Update collection visibility
    collection.visibility = new_visibility

    # ✅ Recursively update all poems when collection visibility changes
    for poem in collection.poems:
        poem.visibility = new_visibility  # ✅ Update all poems to match collection visibility

    db.session.commit()
    return jsonify(status="success", message="Collection visibility updated", visibility=collection.visibility)




@app.route('/update_description', methods=['POST'])
@login_required
def update_description():
    new_description = request.form.get('description')
    current_user.description = new_description
    db.session.commit()
    return jsonify(status="success", description=new_description)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/update_profile_image', methods=['POST'])
@login_required
def update_profile_image():
    if 'profile_image' not in request.files:
        return jsonify(status="error", message="No file part"), 400
    file = request.files['profile_image']
    if file.filename == '':
        return jsonify(status="error", message="No selected file"), 400
    if file and allowed_file(file.filename):
        # Ensure upload folder exists
        if not os.path.exists(app.config['UPLOAD_FOLDER']):
            os.makedirs(app.config['UPLOAD_FOLDER'])
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        # Update the user's profile image URL
        current_user.profile_image = url_for('static', filename='uploads/' + filename)
        db.session.commit()
        return jsonify(status="success", profile_image=current_user.profile_image)
    return jsonify(status="error", message="File not allowed"), 400

@app.route('/search')
def search():
    query = request.args.get('q', '')
    user_results = []
    poem_results = []
    prompt_results = []
    if query:
        # Search for users by username (case-insensitive)
        user_results = User.query.filter(User.username.ilike(f"%{query}%")).all()
        
        # Search for poems by title and content (only public poems)
        poem_results = Poem.query.filter(
            Poem.visibility=='public',
            ((Poem.title.ilike(f"%{query}%")) | (Poem.content.ilike(f"%{query}%")))
        ).all()
        
        # Also include poems whose tags match the query
        tag_poems = Poem.query.join(Poem.tags).filter(Tag.name.ilike(f"%{query.lower()}%")).all()
        poem_results = list({p.id: p for p in poem_results + tag_poems}.values())
        
        # Search for prompts by title or description
        prompt_results = Prompt.query.filter(
            (Prompt.title.ilike(f"%{query}%")) | (Prompt.description.ilike(f"%{query}%"))
        ).all()
    
    return render_template('search.html', query=query, user_results=user_results, poem_results=poem_results, prompt_results=prompt_results)


@app.route('/user/<int:user_id>')
def user_profile(user_id):
    # Get the user by id (404 if not found)
    user = User.query.get_or_404(user_id)
    # Render the public profile view
    return render_template('user_profile.html', user=user)

@app.route('/public_collection/<int:collection_id>')
def public_collection(collection_id):
    collection_obj = Collection.query.get_or_404(collection_id)
    # Only allow access if the collection is public or if the current user is the owner.
    if collection_obj.visibility != 'public' and (not current_user.is_authenticated or current_user.id != collection_obj.user_id):
        flash("This collection is private.", "danger")
        return redirect(url_for('home'))
    # Filter poems: only public poems should be shown
    public_poems = [poem for poem in collection_obj.poems if poem.visibility == 'public']
    return render_template('user_collection.html', collection=collection_obj, poems=public_poems)

@app.route('/get_comments/<int:poem_id>')
def get_comments(poem_id):
    poem = Poem.query.get_or_404(poem_id)
    comments = Comment.query.filter_by(poem_id=poem_id).order_by(Comment.created_at.desc()).all()
    comments_data = [
        {
            "username": comment.author.username,
            "profile_image": comment.author.profile_image,
            "text": comment.text,
            "created_at": comment.created_at.strftime("%Y-%m-%d %H:%M:%S")
        } 
        for comment in comments
    ]
    return jsonify(comments_data)

@app.route('/poem/<int:poem_id>')
def view_poem(poem_id):
    poem = Poem.query.get_or_404(poem_id)
    if poem.visibility == 'private' and poem.author != current_user:
        flash("This poem is private.", "danger")
        return redirect(url_for('home'))
    return render_template('view_poem.html', poem=poem)

@app.route('/toggle_favorite/<int:poem_id>', methods=['POST'])
@login_required
def toggle_favorite(poem_id):
    poem = Poem.query.get_or_404(poem_id)
    
    # Check if the poem is already favorited
    if poem in current_user.favorite_poems:
        current_user.favorite_poems.remove(poem)  # Unstar the poem
        db.session.commit()
        return jsonify(status="success", message="Poem removed from favorites", favorited=False)
    else:
        # Star the poem
        current_user.favorite_poems.append(poem)

        # Only add the poem to the user's favorite list without using a collection
        current_user.favorite_poems.append(poem)
        db.session.commit()

        return jsonify(status="success", message="Poem added to favorites", favorited=True)


@app.route('/favorites')
@login_required
def favorites():
    poems = current_user.favorite_poems  # Retrieve all poems favorited by the user

    # Extract unique poem types for filtering
    poem_types = sorted(set(poem.poem_type for poem in poems if poem.poem_type))

    return render_template('favorites.html', poems=poems, poem_types=poem_types)


@app.route('/autocomplete_tags')
def autocomplete_tags():
    query = request.args.get('query', '')
    if query:
        tags = Tag.query.filter(Tag.name.ilike(f"%{query}%")).all()
    else:
        tags = []
    results = [tag.name for tag in tags]
    return jsonify(results)

@app.route('/prompts', methods=['GET', 'POST'])
@login_required
def prompts():
    if request.method == 'POST':
        title = request.form.get('title')
        description = request.form.get('description')
        if not title:
            flash("Please provide a title for the prompt.", "danger")
            return redirect(url_for('prompts'))
        new_prompt = Prompt(title=title, description=description, created_by=current_user.id)
        db.session.add(new_prompt)
        db.session.commit()
        flash("Prompt added successfully!", "success")
        return redirect(url_for('prompts'))
    all_prompts = Prompt.query.order_by(Prompt.created_at.desc()).all()
    return render_template('prompts.html', prompts=all_prompts)

@app.route('/prompt/<int:prompt_id>')
def view_prompt(prompt_id):
    prompt_obj = Prompt.query.get_or_404(prompt_id)
    # Only display public poems under this prompt.
    poems_under_prompt = Poem.query.filter_by(prompt_id=prompt_obj.id, visibility='public').all()
    return render_template('view_prompt.html', prompt=prompt_obj, poems=poems_under_prompt)

@app.route('/follow/<int:user_id>', methods=['POST'])
@login_required
def follow(user_id):
    if current_user.id == user_id:
        return jsonify(status="error", message="You cannot follow yourself."), 400
    user_to_follow = User.query.get_or_404(user_id)
    if current_user.following.filter_by(id=user_to_follow.id).first():
        return jsonify(status="error", message="Already following."), 400
    current_user.following.append(user_to_follow)
    db.session.commit()
    return jsonify(status="success", message="Now following.", following=True)

@app.route('/unfollow/<int:user_id>', methods=['POST'])
@login_required
def unfollow(user_id):
    if current_user.id == user_id:
        return jsonify(status="error", message="You cannot unfollow yourself."), 400
    user_to_unfollow = User.query.get_or_404(user_id)
    if not current_user.following.filter_by(id=user_to_unfollow.id).first():
        return jsonify(status="error", message="Not following."), 400
    current_user.following.remove(user_to_unfollow)
    db.session.commit()
    return jsonify(status="success", message="Unfollowed.", following=False)


# Route to view all chat groups
@app.route('/chats')
@login_required
def chats():
    groups = current_user.chat_groups.all()
    # Only include users who follow the current user
    users = current_user.followers.all()
    available_users = [{'id': user.id, 'username': user.username} for user in users]
    return render_template('chats.html', groups=groups, available_users=available_users)

# Route to view a specific chat group (conversation)
@app.route('/chat_group/<int:group_id>')
@login_required
def chat_group(group_id):
    group = ChatGroup.query.get_or_404(group_id)
    if current_user not in group.members:
        flash("You are not a member of that group.", "danger")
        return redirect(url_for('chats'))
    return render_template('chat_group.html', group=group)

# Route to create a new chat group
@app.route('/create_chat_group', methods=['GET', 'POST'])
@login_required
def create_chat_group():
    group_name = request.form.get('group_name')
    member_ids = request.form.getlist('members')  # list of selected user IDs
    if not group_name:
        flash("Group name is required.", "danger")
        return redirect(url_for('chats'))
    group = ChatGroup(name=group_name)
    group.members.append(current_user)  # add the creator
    for uid in member_ids:
        user = User.query.get(uid)
        if user and user not in group.members:
            group.members.append(user)
    db.session.add(group)
    db.session.commit()
    flash("Chat group created!", "success")
    return redirect(url_for('chats'))

# Route to send a message to a chat group
@app.route('/send_message/<int:group_id>', methods=['POST'])
@login_required
def send_message(group_id):
    group = ChatGroup.query.get_or_404(group_id)
    if current_user not in group.members:
        return jsonify({'status': 'error', 'message': 'You are not a member of this group.'}), 403
    content = request.form.get('message')
    if not content:
        return jsonify({'status': 'error', 'message': 'No message content provided.'}), 400
    msg = Message(content=content, chat_group=group, sender=current_user)
    db.session.add(msg)
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Message sent.'})

# Route to fetch messages for a chat group (for AJAX polling)
@app.route('/get_messages/<int:group_id>')
@login_required
def get_messages(group_id):
    group = ChatGroup.query.get_or_404(group_id)
    if current_user not in group.members:
        return jsonify({'status': 'error', 'message': 'You are not a member of this group.'}), 403
    messages = group.messages.order_by(Message.timestamp.asc()).all()
    messages_data = []
    for msg in messages:
        messages_data.append({
            'id': msg.id,
            'content': msg.content,
            'timestamp': msg.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            'sender': msg.sender.username,
            'sender_profile': msg.sender.profile_image if hasattr(msg.sender, 'profile_image') else None
        })
    return jsonify(messages_data)

# @socketio.on('join')
# def on_join(data):
#     room = data['group_id']
#     join_room(room)
#     emit('status', {'msg': f"{data['username']} has entered the room."}, room=room)

# @socketio.on('typing')
# def on_typing(data):
#     room = data['group_id']
#     emit('typing', {'username': data['username']}, room=room)

# @socketio.on('stop_typing')
# def on_stop_typing(data):
#     room = data['group_id']
#     emit('stop_typing', {'username': data['username']}, room=room)

# @socketio.on('new_message')
# def on_new_message(data):
#     room = data['group_id']
#     # You may process and store the message here, then broadcast:
#     emit('new_message', data, room=room)


@app.route('/leave_group/<int:group_id>', methods=['POST'])
@login_required
def leave_group(group_id):
    group = ChatGroup.query.get_or_404(group_id)
    if current_user not in group.members:
        return jsonify({'status': 'error', 'message': 'You are not a member of this group.'})
    
    try:
        # Remove the user from the group members
        group.members.remove(current_user)
        
        # Create a system message indicating the user left
        system_message = Message(
            content=f"{current_user.username} has left the group.",
            chat_group=group,
            sender=current_user,  # Optionally, you can use a system user; here we tag the user who left.
            is_system=True
        )
        db.session.add(system_message)
        db.session.commit()
        
        return jsonify({'status': 'success', 'message': 'Successfully left the group.'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)})

# New endpoint to fetch group details (including members and creation date)
@app.route('/get_group_details/<int:group_id>')
@login_required
def get_group_details(group_id):
    group = ChatGroup.query.get_or_404(group_id)
    if current_user not in group.members:
        return jsonify({'status': 'error', 'message': 'You are not a member of this group.'}), 403
    group_details = {
        'id': group.id,
        'name': group.name,
        'created_at': group.created_at.strftime("%Y-%m-%d %H:%M:%S") if group.created_at else "",
        'members': [{'id': m.id, 'username': m.username} for m in group.members]
    }
    return jsonify({'status': 'success', 'group': group_details})


# Route to update the group name via AJAX
@app.route('/update_group_name/<int:group_id>', methods=['POST'])
@login_required
def update_group_name(group_id):
    group = ChatGroup.query.get_or_404(group_id)
    if current_user not in group.members:
        return jsonify({'status': 'error', 'message': 'You are not a member of this group.'}), 403
    new_name = request.form.get('group_name')
    if not new_name:
        return jsonify({'status': 'error', 'message': 'Group name cannot be empty.'}), 400
    group.name = new_name
    db.session.commit()
    return jsonify({'status': 'success', 'group_name': new_name})


# Route to update group members via AJAX
@app.route('/update_group_members/<int:group_id>', methods=['POST'])
@login_required
def update_group_members(group_id):
    group = ChatGroup.query.get_or_404(group_id)
    if current_user not in group.members:
        return jsonify({'status': 'error', 'message': 'You are not a member of this group.'}), 403
    # Expect a list of user IDs (strings) sent as form data under 'members'
    member_ids = request.form.getlist('members')
    # Always keep the current user in the group
    new_members = [current_user]
    for uid in member_ids:
        user = User.query.get(uid)
        if user and user not in new_members:
            new_members.append(user)
    group.members = new_members
    db.session.commit()
    # Prepare a simple list of updated member info
    members_data = [{'id': m.id, 'username': m.username} for m in group.members]
    return jsonify({'status': 'success', 'members': members_data})



@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('profile'))
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        if User.query.filter_by(username=username).first():
            flash("Username already exists.", "danger")
            return redirect(url_for('register'))
        if User.query.filter_by(email=email).first():
            flash("Email already registered.", "danger")
            return redirect(url_for('register'))
        hashed_pw = generate_password_hash(password)
        default_image = url_for('static', filename='uploads/download.png')
        new_user = User(username=username, email=email, password=hashed_pw, profile_image=default_image)
        db.session.add(new_user)
        db.session.commit()
        flash("Registration successful! Please log in.", "success")
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('profile'))
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password, password):
            login_user(user)
            flash("Logged in successfully!", "success")
            next_page = request.args.get('next')
            return redirect(next_page) if next_page else redirect(url_for('profile'))
        else:
            flash("Invalid username or password", "danger")
            return redirect(url_for('login'))
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash("Logged out successfully", "success")
    return redirect(url_for('home'))

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)

