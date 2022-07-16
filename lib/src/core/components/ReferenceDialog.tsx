import React, { useCallback, useEffect, useState } from "react";
import {
    CollectionSize,
    Entity,
    EntityCollection,
    FilterValues
} from "../../models";
import { Box, Button, Typography } from "@mui/material";

import { EntityCollectionTable } from "./EntityCollectionTable";
import {
    CollectionRowActions
} from "./EntityCollectionTable/internal/CollectionRowActions";
import { useDataSource, useNavigationContext } from "../../hooks";
import { ErrorView } from "./ErrorView";
import { CustomDialogActions } from "./CustomDialogActions";
import { useSideDialogsController } from "../../hooks/useSideDialogsController";
import { useSideDialogContext } from "../SideDialogs";

/**
 * @category Components
 */
export interface ReferenceDialogProps {

    /**
     * Allow multiple selection of values
     */
    multiselect: boolean;

    /**
     * Entity collection config
     */
    collection: EntityCollection;

    /**
     * Absolute path of the collection.
     * May be not set if this hook is being used in a component and the path is
     * dynamic. If not set, the dialog won't open.
     */
    path: string;

    /**
     * If you are opening the dialog for the first time, you can select some
     * entity ids to be displayed first.
     */
    selectedEntityIds?: string[];

    /**
     * If `multiselect` is set to `false`, you will get the select entity
     * in this callback.
     * @param entity
     * @callback
        */
    onSingleEntitySelected?(entity: Entity<any> | null): void;

    /**
     * If `multiselect` is set to `true`, you will get the selected entities
     * in this callback.
     * @param entities
     * @callback
        */
    onMultipleEntitiesSelected?(entities: Entity<any>[]): void;

    /**
     * Is the dialog currently open
     * @callback
        */
    onClose?(): void;

    /**
     * Allow selection of entities that pass the given filter only.
     */
    forceFilter?: FilterValues<string>;

}

export function useReferenceDialogController(referenceDialogProps: Omit<ReferenceDialogProps, "path"> & {
    path?: string | false;
}) {

    const sideDialogsController = useSideDialogsController();
    const open = useCallback(() => {
        if (referenceDialogProps.path) {
            sideDialogsController.open({
                key: `reference_${referenceDialogProps.path}`,
                Component: ReferenceDialog,
                props: referenceDialogProps as ReferenceDialogProps,
                width: "90vw"
            });
        }
    }, [referenceDialogProps, sideDialogsController]);

    const close = useCallback(() => {
        sideDialogsController.close();
    }, [sideDialogsController]);

    return {
        open,
        close
    }

}

/**
 * This component renders an overlay dialog that allows to select entities
 * in a given collection.
 * You probably want to open this dialog as a side view using {@link useReferenceDialogController}
 * @category Components
 */
export function ReferenceDialog(
    {
        onSingleEntitySelected,
        onMultipleEntitiesSelected,
        onClose,
        multiselect,
        collection,
        path: pathInput,
        selectedEntityIds,
        forceFilter
    }: ReferenceDialogProps) {

    const navigationContext = useNavigationContext();
    const sideDialogContext = useSideDialogContext();

    const fullPath = navigationContext.resolveAliasesFrom(pathInput);

    const dataSource = useDataSource();

    const [selectedEntities, setSelectedEntities] = useState<Entity<any>[] | undefined>();

    /**
     * Fetch initially selected ids
     */
    useEffect(() => {
        let unmounted = false;
        if (selectedEntityIds && collection) {
            Promise.all(
                selectedEntityIds.map((entityId) => {
                    return dataSource.fetchEntity({
                        path: fullPath,
                        entityId,
                        collection
                    });
                }))
                .then((entities) => {
                    if (!unmounted)
                        setSelectedEntities(entities.filter(e => e !== undefined) as Entity<any>[]);
                });
        } else {
            setSelectedEntities([]);
        }
        return () => {
            unmounted = true;
        };
    }, [dataSource, fullPath, selectedEntityIds, collection]);

    const onClear = useCallback(() => {
        if (!multiselect && onSingleEntitySelected) {
            onSingleEntitySelected(null);
        } else if (onMultipleEntitiesSelected) {
            onMultipleEntitiesSelected([]);
        }
    }, [multiselect, onMultipleEntitiesSelected, onSingleEntitySelected]);

    const toggleEntitySelection = useCallback((entity: Entity<any>) => {
        let newValue;
        if (selectedEntities) {
            if (selectedEntities.map((e) => e.id).indexOf(entity.id) > -1) {
                newValue = selectedEntities.filter((item: Entity<any>) => item.id !== entity.id);
            } else {
                newValue = [...selectedEntities, entity];
            }
            setSelectedEntities(newValue);

            if (onMultipleEntitiesSelected)
                onMultipleEntitiesSelected(newValue);
        }
    }, [onMultipleEntitiesSelected, selectedEntities]);

    const onEntityClick = useCallback((entity: Entity<any>) => {
        if (!multiselect && onSingleEntitySelected) {
            onSingleEntitySelected(entity);
            sideDialogContext.close();
        } else {
            toggleEntitySelection(entity);
        }
    }, [sideDialogContext, multiselect, onSingleEntitySelected, toggleEntitySelection]);

    const tableRowActionsBuilder = useCallback(({
                                                    entity,
                                                    size,
                                                    width,
                                                    frozen
                                                }: { entity: Entity<any>, size: CollectionSize, width: number, frozen?: boolean }) => {

        const isSelected = selectedEntities && selectedEntities.map(e => e.id).indexOf(entity.id) > -1;
        return <CollectionRowActions
            width={width}
            frozen={frozen}
            entity={entity}
            size={size}
            isSelected={isSelected}
            selectionEnabled={multiselect}
            toggleEntitySelection={toggleEntitySelection}
        />;

    }, [multiselect, selectedEntities, toggleEntitySelection]);

    const onDone = useCallback((event: React.SyntheticEvent) => {
        event.stopPropagation();
        sideDialogContext.close();
        if (onClose)
            onClose();
    }, [onClose]);

    if (!collection) {
        return <ErrorView
            error={"Could not find collection with id " + collection}/>

    }
    return (

        <Box sx={{
            display: "flex",
            flexDirection: "column",
                height: "100%"
            }}>

                <Box sx={{ flexGrow: 1}}>
                {selectedEntities &&
                    <EntityCollectionTable fullPath={fullPath}
                                           onEntityClick={onEntityClick}
                                           forceFilter={forceFilter}
                                           tableRowActionsBuilder={tableRowActionsBuilder}
                                           Title={<Typography variant={"h6"}>
                                               {collection.singularName ? `Select ${collection.singularName}` : `Select from ${collection.name}`}
                                           </Typography>}
                                           {...collection}
                                           inlineEditing={false}
                                           Actions={<Button onClick={onClear}
                                                            color="primary">
                                               Clear
                                           </Button>}
                                           entitiesDisplayedFirst={selectedEntities}
                    />}
                </Box>
                <CustomDialogActions translucent={false}>
                    <Button
                        onClick={onDone}
                        color="primary"
                        variant="outlined">
                        Done
                    </Button>
                </CustomDialogActions>
            </Box>

    );

}