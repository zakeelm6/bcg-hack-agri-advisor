"""reading quality flags and learned plot offsets (Phase 2)

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa


revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('readings') as b:
        b.add_column(sa.Column('flags', sa.Text(), server_default='[]', nullable=False))
    op.create_table('plot_offsets',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('field_id', sa.Integer(), nullable=False),
    sa.Column('zone_code', sa.Text(), nullable=False),
    sa.Column('sentinel_zone', sa.Text(), nullable=False),
    sa.Column('delta', sa.Float(), nullable=False),
    sa.Column('sdrd', sa.Float(), nullable=False),
    sa.Column('n_samples', sa.Integer(), nullable=False),
    sa.Column('learned_at', sa.Text(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('field_id', 'zone_code')
    )


def downgrade():
    op.drop_table('plot_offsets')
    with op.batch_alter_table('readings') as b:
        b.drop_column('flags')
