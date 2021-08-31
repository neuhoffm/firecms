import React, { useState } from "react";
import {
    Box,
    Button,
    IconButton,
    Popover,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme
} from "@material-ui/core";
import { Add, Delete } from "@material-ui/icons";


import {
    AdditionalColumnDelegate,
    CollectionSize,
    Entity,
    EntityCollection
} from "../../models";
import CollectionTable from "../../collection/components/CollectionTable";

import {
    useAuthController,
    useCMSAppContext,
    useSideEntityController
} from "../../contexts";

import CollectionRowActions
    from "../../collection/internal/CollectionRowActions";
import DeleteEntityDialog from "../../collection/internal/DeleteEntityDialog";
import ExportButton from "../../collection/internal/ExportButton";
import {
    getSubcollectionColumnId,
    useColumnIds
} from "../../collection/common";

import { canCreate, canDelete, canEdit } from "../../util/permissions";
import {
    OnCellValueChange,
    UniqueFieldValidator
} from "../../collection/components/CollectionTableProps";
import { Markdown } from "../../preview";
import { useDataSource } from "../../hooks/useDataSource";

export type EntityCollectionProps<M extends { [Key: string]: any }> = {
    path: string;
    collectionConfig: EntityCollection<M>;
}

/**
 * This component is in charge of binding a Firestore path with an {@link EntityCollection}
 * where it's configuration is defined. This is useful if you have defined already
 * your entity collections and need to build a custom component.
 *
 * Please note that you only need to use this component if you are building
 * a custom view. If you just need to create a default view you can do it
 * exclusively with config options.
 *
 * If you need a lower level implementation with more granular options, you
 * can try {@link CollectionTable}, which still does data fetching from Firestore.
 *
 * @param path
 * @param collectionConfig
 * @constructor
 * @category Core components
 */
export default function EntityCollectionTable<M extends { [Key: string]: any }>({
                                                                                                   path,
                                                                                                   collectionConfig
                                                                                               }: EntityCollectionProps<M>
) {

    const sideEntityController = useSideEntityController();

    const dataSource = useDataSource();
    const theme = useTheme();
    const largeLayout = useMediaQuery(theme.breakpoints.up("md"));

    const context = useCMSAppContext();
    const authController = useAuthController();

    const [deleteEntityClicked, setDeleteEntityClicked] = React.useState<Entity<M> | Entity<M>[] | undefined>(undefined);
    const [selectedEntities, setSelectedEntities] = useState<Entity<M>[]>([]);

    const exportable = collectionConfig.exportable === undefined || collectionConfig.exportable;
    const inlineEditing = collectionConfig.inlineEditing === undefined || collectionConfig.inlineEditing;

    const selectionEnabled = collectionConfig.selectionEnabled === undefined || collectionConfig.selectionEnabled;
    const paginationEnabled = collectionConfig.pagination === undefined || Boolean(collectionConfig.pagination);
    const pageSize = typeof collectionConfig.pagination === "number" ? collectionConfig.pagination : undefined;
    const displayedProperties = useColumnIds(collectionConfig, true);

    const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

    const subcollectionColumns: AdditionalColumnDelegate<any>[] = collectionConfig.subcollections?.map((subcollection) => {
        return {
            id: getSubcollectionColumnId(subcollection),
            title: subcollection.name,
            width: 200,
            builder: ({ entity }) => (
                <Button color={"primary"}
                        onClick={(event) => {
                            event.stopPropagation();
                            sideEntityController.open({
                                path,
                                entityId: entity.id,
                                selectedSubpath: subcollection.relativePath,
                                permissions: collectionConfig.permissions,
                                schema: collectionConfig.schema,
                                subcollections: collectionConfig.subcollections,
                                overrideSchemaResolver: false
                            });
                        }}>
                    {subcollection.name}
                </Button>
            )
        };
    }) ?? [];

    const additionalColumns = [...(collectionConfig.additionalColumns ?? []), ...subcollectionColumns];

    const onEntityClick = (entity: Entity<M>) => {
        sideEntityController.open({
            entityId: entity.id,
            path,
            permissions: collectionConfig.permissions,
            schema: collectionConfig.schema,
            subcollections: collectionConfig.subcollections,
            overrideSchemaResolver: false
        });
    };

    const onNewClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        return path && sideEntityController.open({
            path,
            permissions: collectionConfig.permissions,
            schema: collectionConfig.schema,
            subcollections: collectionConfig.subcollections,
            overrideSchemaResolver: false
        });
    };

    const internalOnEntityDelete = (path: string, entity: Entity<M>) => {
        setSelectedEntities(selectedEntities.filter((e) => e.id !== entity.id));
    };

    const internalOnMultipleEntitiesDelete = (path: string, entities: Entity<M>[]) => {
        setSelectedEntities([]);
    };

    const checkInlineEditing = (entity: Entity<any>) => {
        if (!canEdit(collectionConfig.permissions, entity, authController, path, context)) {
            return false;
        }
        return inlineEditing;
    };

    const onCellChanged: OnCellValueChange<any, M> = ({
                                                               value,
                                                               name,
                                                               setSaved,
                                                               setError,
                                                               entity
                                                           }) => dataSource.saveEntity({
            path,
            entityId: entity.id,
            values: {
                ...entity.values,
                [name]: value
            },
            schema: collectionConfig.schema,
            status: "existing",
            onSaveSuccess: () => setSaved(true),
            onSaveFailure: ((e: Error) => {
                setError(e);
            }),
            context
        }
    );

    const open = anchorEl != null;
    const title = (
        <div style={{
            padding: "4px"
        }}>

            <Typography
                variant="h6"
                style={{
                    lineHeight: "1.0",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    maxWidth: "160px",
                    cursor: collectionConfig.description ? "pointer" : "inherit"
                }}
                onClick={collectionConfig.description ? (e) => {
                    setAnchorEl(e.currentTarget);
                    e.stopPropagation();
                } : undefined}
            >
                {`${collectionConfig.name}`}
            </Typography>
            <Typography
                style={{
                    display: "block",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    maxWidth: "160px",
                    direction: "rtl",
                    textAlign: "left"
                }}
                variant={"caption"}
                color={"textSecondary"}>
                {`/${path}`}
            </Typography>

            {collectionConfig.description &&
            <Popover
                id={"info-dialog"}
                open={open}
                anchorEl={anchorEl}
                elevation={1}
                onClose={() => {
                    setAnchorEl(null);
                }}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "center"
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "center"
                }}
            >

                <Box m={2}>
                    <Markdown source={collectionConfig.description}/>
                </Box>

            </Popover>
            }

        </div>
    );

    const toggleEntitySelection = (entity: Entity<M>) => {
        let newValue;
        if (selectedEntities.indexOf(entity) > -1) {
            newValue = selectedEntities.filter((item: Entity<M>) => item !== entity);
        } else {
            newValue = [...selectedEntities, entity];
        }
        setSelectedEntities(newValue);
    };


    const uniqueFieldValidator: UniqueFieldValidator = ({
                                                            name,
                                                            value,
                                                            property,
                                                            entityId
                                                        }) => dataSource.checkUniqueField(path, name, value, property, entityId);

    const tableRowActionsBuilder = ({
                                        entity,
                                        size
                                    }: { entity: Entity<any>, size: CollectionSize }) => {

        const isSelected = selectedEntities.indexOf(entity) > -1;

        const createEnabled = canCreate(collectionConfig.permissions, authController, path, context);
        const editEnabled = canEdit(collectionConfig.permissions, entity, authController, path, context);
        const deleteEnabled = canDelete(collectionConfig.permissions, entity, authController, path, context);

        const onCopyClicked = (entity: Entity<M>) => sideEntityController.open({
            entityId: entity.id,
            path,
            copy: true,
            permissions: {
                edit: editEnabled,
                create: createEnabled,
                delete: deleteEnabled
            },
            schema: collectionConfig.schema,
            subcollections: collectionConfig.subcollections,
            overrideSchemaResolver: false
        });

        const onEditClicked = (entity: Entity<M>) => sideEntityController.open({
            entityId: entity.id,
            path,
            permissions: {
                edit: editEnabled,
                create: createEnabled,
                delete: deleteEnabled
            },
            schema: collectionConfig.schema,
            subcollections: collectionConfig.subcollections,
            overrideSchemaResolver: false
        });

        return (
            <CollectionRowActions
                entity={entity}
                isSelected={isSelected}
                selectionEnabled={selectionEnabled}
                size={size}
                toggleEntitySelection={toggleEntitySelection}
                onEditClicked={onEditClicked}
                onCopyClicked={editEnabled ? onCopyClicked : undefined}
                onDeleteClicked={deleteEnabled ? setDeleteEntityClicked : undefined}
            />
        );

    };

    function toolbarActionsBuilder({
                                       size,
                                       data
                                   }: { size: CollectionSize, data: Entity<any>[] }) {

        const addButton = canCreate(collectionConfig.permissions, authController, path, context) && onNewClick && (largeLayout ?
            <Button
                onClick={onNewClick}
                startIcon={<Add/>}
                size="large"
                variant="contained"
                color="primary">
                Add {collectionConfig.schema.name}
            </Button>
            : <Button
                onClick={onNewClick}
                size="medium"
                variant="contained"
                color="primary"
            >
                <Add/>
            </Button>);

        const multipleDeleteEnabled = selectedEntities.every((entity) => canDelete(collectionConfig.permissions, entity, authController, path, context));
        const onMultipleDeleteClick = (event: React.MouseEvent) => {
            event.stopPropagation();
            setDeleteEntityClicked(selectedEntities);
        };
        const multipleDeleteButton = selectionEnabled &&

            <Tooltip
                title={multipleDeleteEnabled ? "Multiple delete" : "You have selected one entity you cannot delete"}>
                <span>
                    {largeLayout && <Button
                        disabled={!(selectedEntities?.length) || !multipleDeleteEnabled}
                        startIcon={<Delete/>}
                        onClick={onMultipleDeleteClick}
                        color={"primary"}
                    >
                        <p style={{ minWidth: 24 }}>({selectedEntities?.length})</p>
                    </Button>}

                    {!largeLayout &&
                    <IconButton
                        color={"primary"}
                        disabled={!(selectedEntities?.length) || !multipleDeleteEnabled}
                        onClick={onMultipleDeleteClick}
                        size="large">
                        <Delete/>
                    </IconButton>}
                </span>
            </Tooltip>;

        const extraActions = collectionConfig.extraActions ? collectionConfig.extraActions({
            path,
            collection: collectionConfig,
            selectedEntities,
            context
        }) : undefined;

        const exportButton = exportable &&
            <ExportButton schema={collectionConfig.schema}
                          exportConfig={typeof collectionConfig.exportable === "object" ? collectionConfig.exportable : undefined}
                          path={path}/>;

        return (
            <>
                {extraActions}
                {multipleDeleteButton}
                {exportButton}
                {addButton}
            </>
        );
    }

    return (
        <>

            <CollectionTable
                title={title}
                frozenIdColumn={largeLayout}
                path={path}
                schema={collectionConfig.schema}
                additionalColumns={additionalColumns}
                defaultSize={collectionConfig.defaultSize}
                displayedProperties={displayedProperties}
                initialFilter={collectionConfig.initialFilter}
                initialSort={collectionConfig.initialSort}
                textSearchDelegate={collectionConfig.textSearchDelegate}
                paginationEnabled={paginationEnabled}
                pageSize={pageSize}
                indexes={collectionConfig.indexes}
                inlineEditing={checkInlineEditing}
                uniqueFieldValidator={uniqueFieldValidator}
                onEntityClick={onEntityClick}
                onCellValueChange={onCellChanged}
                tableRowActionsBuilder={tableRowActionsBuilder}
                toolbarActionsBuilder={toolbarActionsBuilder}
            />

            <DeleteEntityDialog entityOrEntitiesToDelete={deleteEntityClicked}
                                path={path}
                                schema={collectionConfig.schema}
                                open={!!deleteEntityClicked}
                                onEntityDelete={internalOnEntityDelete}
                                onMultipleEntitiesDelete={internalOnMultipleEntitiesDelete}
                                onClose={() => setDeleteEntityClicked(undefined)}/>
        </>
    );
}

export { EntityCollectionTable };
