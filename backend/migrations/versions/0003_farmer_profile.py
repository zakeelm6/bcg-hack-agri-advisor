"""farmer profile (Phase 3, roadmap step 6)

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa


revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('farmers',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('location', sa.Text(), nullable=True),
    sa.Column('crop', sa.Text(), nullable=True),
    sa.Column('planted_on', sa.Text(), nullable=True),
    sa.Column('area_ha', sa.Float(), nullable=True),
    sa.Column('irrigation', sa.Text(), nullable=True),
    sa.Column('challenge', sa.Text(), nullable=True),
    sa.Column('lat', sa.Float(), nullable=True),
    sa.Column('lon', sa.Float(), nullable=True),
    sa.Column('lang', sa.Text(), nullable=True),
    sa.Column('updated_at', sa.Text(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('farmers')
