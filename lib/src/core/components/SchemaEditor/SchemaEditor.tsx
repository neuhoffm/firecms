import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as Yup from "yup";
import Tree, {
    moveItemOnTree,
    RenderItemParams,
    TreeData,
    TreeDestinationPosition,
    TreeSourcePosition
} from "../Tree";
import {
    TreeDraggableProvided
} from "../Tree/components/TreeItem/TreeItem-types";

import { Formik, FormikProps, getIn, useFormikContext } from "formik";

import equal from "react-fast-compare"
import DragHandleIcon from "@mui/icons-material/DragHandle";
import {
    Box,
    Button,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    FormControl,
    FormHelperText,
    Grid,
    IconButton,
    InputLabel,
    OutlinedInput,
    Paper,
    Typography,
    useMediaQuery,
    useTheme
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import {
    getIconForProperty,
    getWidgetNameForProperty
} from "../../util/property_utils";

import { EntitySchema, Property, PropertyOrBuilder } from "../../../models";
import { propertiesToTree, treeToProperties } from "./util";
import {
    prepareSchemaForPersistence,
    sortProperties
} from "../../util/schemas";
import { getWidget } from "../../util/widgets";
import { PropertyForm } from "./PropertyEditView";
import { useSnackbarController } from "../../../hooks";
import {
    useConfigurationPersistence
} from "../../../hooks/useConfigurationPersistence";
import { ErrorView } from "../ErrorView";
import { CircularProgressCenter } from "../CircularProgressCenter";
import { useSchemaRegistry } from "../../../hooks/useSchemaRegistry";
import { toSnakeCase } from "../../util/strings";

export type SchemaEditorProps<M> = {
    schemaId?: string;
    handleClose?: (updatedSchema?: EntitySchema<M>) => void;
    updateDirtyStatus?: (dirty: boolean) => void;
};

const YupSchema = Yup.object().shape({
    id: Yup.string().required("Required"),
    name: Yup.string().required("Required")
});

export function SchemaEditor<M>({
                                    schemaId,
                                    handleClose,
                                    updateDirtyStatus
                                }: SchemaEditorProps<M>) {

    const isNewSchema = !schemaId;
    const schemaRegistry = useSchemaRegistry();
    const configurationPersistence = useConfigurationPersistence();
    const snackbarContext = useSnackbarController();

    if (!configurationPersistence)
        throw Error("Can't use the schema editor without specifying a `ConfigurationPersistence`");

    const [schema, setSchema] = React.useState<EntitySchema | undefined>();
    const [error, setError] = React.useState<Error | undefined>();

    useEffect(() => {
        try {
            if (schemaRegistry.initialised) {
                if (schemaId) {
                    setSchema(schemaRegistry.findSchema(schemaId));
                } else {
                    setSchema(undefined);
                }
            }
        } catch (e) {
            console.error(e);
            setError(error);
        }
    }, [schema, schemaRegistry]);

    if (error) {
        return <ErrorView error={`Error fetching schema ${schemaId}`}/>;
    }

    if (!schemaRegistry.initialised || !(isNewSchema || schema)) {
        return <CircularProgressCenter/>;
    }

    const saveSchema = (schema: EntitySchema<M>): Promise<boolean> => {
        const newSchema = prepareSchemaForPersistence(schema);
        return configurationPersistence.saveSchema(newSchema)
            .then(() => {
                setError(undefined);
                snackbarContext.open({
                    type: "success",
                    message: "Schema updated"
                });
                if (handleClose) {
                    handleClose(schema);
                }
                return true;
            })
            .catch((e) => {
                console.error(e);
                snackbarContext.open({
                    type: "error",
                    title: "Error persisting schema",
                    message: "Details in the console"
                });
                return false;
            });
    };

    return (
        <Formik
            initialValues={schema ?? {
                id: "",
                name: "",
                properties: {}
            } as EntitySchema}
            validationSchema={YupSchema}
            onSubmit={(newSchema: EntitySchema, formikHelpers) => {
                return saveSchema(newSchema).then(() => formikHelpers.resetForm({ values: newSchema }));
            }}
        >
            {(formikProps) => {
                return (
                    <SchemaEditorForm {...formikProps}
                                      updateDirtyStatus={updateDirtyStatus}
                                      isNewSchema={isNewSchema}
                                      onCancel={handleClose ? () => handleClose(undefined) : undefined}/>
                );
            }}

        </Formik>

    );
}

function SchemaEditorForm<M>({
                                 values,
                                 setFieldValue,
                                 handleChange,
                                 touched,
                                 errors,
                                 dirty,
                                 isSubmitting,
                                 isNewSchema,
                                 handleSubmit,
                                 updateDirtyStatus,
                                 onCancel
                             }: FormikProps<EntitySchema<M>> & {
    isNewSchema: boolean,
    updateDirtyStatus?: (dirty: boolean) => void;
    onCancel?: () => void;
}) {


    const theme = useTheme();
    const largeLayout = useMediaQuery(theme.breakpoints.up("lg"));

    const [selectedPropertyId, setSelectedPropertyId] = useState<string | undefined>();
    const selectedProperty = selectedPropertyId ? values.properties[selectedPropertyId] : undefined;
    const [pendingMove, setPendingMove] = useState<[TreeSourcePosition, TreeDestinationPosition] | undefined>();

    const [newPropertyDialogOpen, setNewPropertyDialogOpen] = useState<boolean>(false);

    useEffect(() => {
        if (updateDirtyStatus)
            updateDirtyStatus(dirty);
    }, [updateDirtyStatus, dirty]);

    useEffect(() => {
        const idTouched = getIn(touched, "id");
        if (!idTouched && isNewSchema && values.name) {
            setFieldValue("id", toSnakeCase(values.name))
        }
    }, [isNewSchema, touched, values.name]);

    const onPropertyClick = useCallback((property: PropertyOrBuilder, propertyId: string) => {
        setSelectedPropertyId(propertyId);
    }, []);

    const renderItem = useCallback(({
                                        item,
                                        onExpand,
                                        onCollapse,
                                        provided,
                                        snapshot
                                    }: RenderItemParams) => {
        const propertyOrBuilder = item.data.property as PropertyOrBuilder;
        return (
            <SchemaEntry
                name={item.id as string}
                propertyOrBuilder={propertyOrBuilder}
                provided={provided}
                onClick={() => onPropertyClick(propertyOrBuilder, item.id as string)}
                selected={snapshot.isDragging || selectedPropertyId === item.id}/>
        )
    }, [selectedPropertyId]);

    const tree = useMemo(() => {
        const sortedProperties = sortProperties(values.properties, values.propertiesOrder);
        return propertiesToTree(sortedProperties);
    }, [values.properties, values.propertiesOrder]);

    const doPropertyMove = useCallback((source: TreeSourcePosition, destination: TreeDestinationPosition) => {
        const newTree = moveItemOnTree(tree, source, destination);
        const [properties, propertiesOrder] = treeToProperties<M>(newTree);

        setFieldValue("propertiesOrder", propertiesOrder);
        setFieldValue("properties", properties);
    }, [tree]);

    const onPropertyCreated = useCallback((id: string, property: Property) => {
        setFieldValue("properties", {
            ...(values.properties ?? {}),
            [id]: property
        });
        setFieldValue("propertiesOrder", [...(values.propertiesOrder ?? []), id]);
        setNewPropertyDialogOpen(false);
    }, [values.properties, values.propertiesOrder]);

    const onDragEnd = (
        source: TreeSourcePosition,
        destination?: TreeDestinationPosition
    ) => {

        if (!destination) {
            return;
        }

        if (!isValidDrag(tree, source, destination)) {
            return;
        }

        if (source.parentId !== destination.parentId) {
            setPendingMove([source, destination]);
        } else {
            doPropertyMove(source, destination);
        }

    };

    const asDialog = !largeLayout;

    const closePropertyDialog = () => {
        setSelectedPropertyId(undefined);
    };

    const propertyEditForm = <PropertyForm
        asDialog={asDialog}
        open={Boolean(selectedPropertyId)}
        key={`edit_view_${selectedPropertyId}`}
        propertyKey={selectedPropertyId}
        property={selectedProperty}
        onPropertyChanged={(id, property) => {
            const propertyPath = selectedPropertyId ? "properties." + selectedPropertyId.replace(".", ".properties.") : undefined;
            if (propertyPath)
                setFieldValue(propertyPath, property);
        }}
        onOkClicked={asDialog
            ? closePropertyDialog
            : undefined
        }/>;

    return (
        <>
            <Box sx={{ p: 2 }}>
                <Container maxWidth={"lg"}>

                    <Typography variant={"h4"}
                                sx={{ py: 3 }}>
                        {values.name ? `${values.name} schema` : "Schema"}
                    </Typography>

                    <Grid container spacing={2}>

                        <Grid item xs={12}>
                            <FormControl fullWidth
                                         required
                                         disabled={!isNewSchema}
                                         error={touched.id && Boolean(errors.id)}>
                                <InputLabel
                                    htmlFor="id">Id</InputLabel>
                                <OutlinedInput
                                    id="id"
                                    value={values.id}
                                    onChange={handleChange}
                                    aria-describedby="id-helper-text"
                                    label="Id"
                                />
                                <FormHelperText
                                    id="id-helper-text">
                                    {touched.id && Boolean(errors.id) ? errors.id : "Id of this schema (e.g 'product')"}
                                </FormHelperText>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                            <FormControl fullWidth
                                         required
                                         error={touched.name && Boolean(errors.name)}>
                                <InputLabel
                                    htmlFor="name">Name</InputLabel>
                                <OutlinedInput
                                    id="name"
                                    value={values.name}
                                    onChange={handleChange}
                                    aria-describedby="name-helper-text"
                                    label="Name"
                                />
                                <FormHelperText
                                    id="name-helper-text">
                                    {touched.name && Boolean(errors.name) ? errors.name : "Singular name of this schema (e.g. Product)"}
                                </FormHelperText>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                            <Box sx={{
                                display: "flex",
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "end",
                                my: 1
                            }}>
                                <Typography
                                    variant={"subtitle2"}>
                                    Properties
                                </Typography>
                                <Button
                                    color="primary"
                                    variant={"outlined"}
                                    onClick={() => setNewPropertyDialogOpen(true)}
                                    startIcon={
                                        <AddIcon/>}
                                >
                                    Add property
                                </Button>
                            </Box>
                            <Paper elevation={0}
                                   variant={"outlined"}
                                   sx={{ p: 3 }}>
                                <Grid container>
                                    <Grid item xs={12}
                                          lg={5}>
                                        <Tree
                                            key={`tree_${selectedPropertyId}`}
                                            tree={tree}
                                            offsetPerLevel={40}
                                            renderItem={renderItem}
                                            onDragEnd={onDragEnd}
                                            isDragEnabled
                                            isNestingEnabled
                                        />
                                    </Grid>

                                    {!asDialog && <Grid item xs={12}
                                                        lg={7}
                                                        sx={(theme) => ({
                                                            borderLeft: `1px solid ${theme.palette.divider}`,
                                                            pl: 2
                                                        })}>
                                        <Box sx={{
                                            position: "sticky",
                                            top: 3,
                                            p: 2
                                        }}>
                                            {selectedPropertyId &&
                                                typeof selectedProperty === "object" &&
                                                propertyEditForm}

                                            {!selectedProperty &&
                                                <Box>
                                                    Select a
                                                    property to
                                                    edit it
                                                </Box>}
                                        </Box>
                                    </Grid>}

                                    {asDialog && typeof selectedProperty === "object" && propertyEditForm}

                                </Grid>
                            </Paper>
                        </Grid>
                    </Grid>

                    {/*<SubmitListener/>*/}

                </Container>
            </Box>

            <Box sx={(theme) => ({
                background: theme.palette.mode === "light" ? "rgba(255,255,255,0.6)" : "rgba(255, 255, 255, 0)",
                backdropFilter: "blur(4px)",
                borderTop: `1px solid ${theme.palette.divider}`,
                py: 1,
                px: 2,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "end",
                position: "sticky",
                bottom: 0,
                zIndex: 200,
                textAlign: "right"
            })}
            >

                {isSubmitting && <Box sx={{ px: 3 }}>
                    <CircularProgress size={16}
                                      thickness={8}/>
                </Box>}

                <Button
                    color="primary"
                    disabled={isSubmitting}
                    onClick={onCancel}
                    sx={{ mr: 2 }}
                >
                    Cancel
                </Button>

                <Button
                    variant="contained"
                    color="primary"
                    type="submit"
                    disabled={isSubmitting || !dirty}
                    onClick={() => handleSubmit()}
                >
                    {isNewSchema ? "Create schema" : "Save schema"}
                </Button>

            </Box>

            <PendingMoveDialog open={Boolean(pendingMove)}
                               onAccept={() => {
                                   setPendingMove(undefined);
                                   if (pendingMove)
                                       doPropertyMove(pendingMove[0], pendingMove[1]);
                               }}
                               onCancel={() => setPendingMove(undefined)}/>

            <PropertyForm asDialog={true}
                          open={newPropertyDialogOpen}
                          onCancel={() => setNewPropertyDialogOpen(false)}
                          onPropertyChanged={onPropertyCreated}/>

        </>
    );
}

function PendingMoveDialog({
                               open,
                               onAccept,
                               onCancel
                           }: { open: boolean, onAccept: () => void, onCancel: () => void }) {
    return <Dialog
        open={open}
        onClose={onCancel}
    >
        <DialogTitle>
            {"Are you sure?"}
        </DialogTitle>
        <DialogContent>
            <DialogContentText>
                You are moving one property from one context to
                another.
            </DialogContentText>
            <DialogContentText>
                This will <b>not transfer the data</b>, only modify
                the schema.
            </DialogContentText>
        </DialogContent>
        <DialogActions>
            <Button
                onClick={onCancel}
                autoFocus>Cancel</Button>
            <Button onClick={onAccept}>
                Proceed
            </Button>
        </DialogActions>
    </Dialog>;
}

export function SchemaEntry({
                                name,
                                propertyOrBuilder,
                                provided,
                                selected,
                                onClick
                            }: {
    name: string;
    propertyOrBuilder: PropertyOrBuilder;
    provided: TreeDraggableProvided;
    selected: boolean;
    onClick: () => void;
}) {

    const widget = typeof propertyOrBuilder !== "function" ? getWidget(propertyOrBuilder) : undefined;
    return (
        <Box sx={{
            display: "flex",
            flexDirection: "row",
            width: "100%",
            py: 1,
            cursor: "pointer"
        }}
             onClick={onClick}
             ref={provided.innerRef}
             {...provided.draggableProps}
             style={{
                 ...provided.draggableProps.style
             }}>

            <Box sx={{
                background: widget?.color ?? "#666",
                height: "32px",
                mt: 0.5,
                padding: 0.5,
                borderRadius: "50%",
                boxShadow: "0px 2px 1px -1px rgb(0 0 0 / 20%), 0px 1px 1px 0px rgb(0 0 0 / 14%), 0px 1px 3px 0px rgb(0 0 0 / 12%)",
                color: "white"
            }}>
                {getIconForProperty(propertyOrBuilder, "inherit", "medium")}
            </Box>
            <Box sx={{
                pl: 3,
                pr: 1,
                width: "100%",
                display: "flex",
                flexDirection: "row"
            }}>
                <Paper variant={"outlined"}
                       sx={(theme) => ({
                           position: "relative",
                           mr: 2,
                           flexGrow: 1,
                           p: 2,
                           border: selected ? `1px solid ${theme.palette.text.primary}` : undefined
                       })}
                       elevation={0}>

                    {typeof propertyOrBuilder === "object"
                        ? <PropertyPreview property={propertyOrBuilder}/>
                        : <PropertyBuilderPreview name={name}/>}

                    <IconButton  {...provided.dragHandleProps}
                                 size="small"
                                 sx={{
                                     position: "absolute",
                                     top: 8,
                                     right: 8
                                 }}>
                        <DragHandleIcon fontSize={"small"}/>
                    </IconButton>
                </Paper>
            </Box>
        </Box>
    );

}

export function SubmitListener() {

    const formik = useFormikContext()
    const [lastValues, setLastValues] = React.useState(formik.values);

    React.useEffect(() => {
        const valuesEqualLastValues = equal(lastValues, formik.values)
        const valuesEqualInitialValues = equal(formik.values, formik.initialValues)

        if (!valuesEqualLastValues) {
            setLastValues(formik.values)
        }

        const doSubmit = () => {
            if (!valuesEqualLastValues && !valuesEqualInitialValues && formik.isValid) {
                formik.submitForm();
            }
        }

        const handler = setTimeout(doSubmit, 300);
        return () => {
            clearTimeout(handler);
        };
    }, [formik.values, formik.isValid])

    return null;
}

function PropertyPreview({
                             property
                         }: { property: Property }) {
    return (
        <Box sx={{ width: "100%", display: "flex", flexDirection: "column" }}>

            <Typography variant="subtitle1"
                        component="span"
                        sx={{ flexGrow: 1, pr: 2 }}>
                {property.title}
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "row" }}>
                <Typography sx={{ flexGrow: 1, pr: 2 }}
                            variant="body2"
                            component="span"
                            color="text.secondary">
                    {getWidgetNameForProperty(property)}
                </Typography>
                <Typography variant="body2"
                            component="span"
                            color="text.disabled">
                    {property.dataType}
                </Typography>
            </Box>
        </Box>
    );
}

function PropertyBuilderPreview({
                                    name
                                }: { name: string }) {
    return (
        <Box sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
            <Typography variant="body2"
                        component="span"
                        color="text.disabled">
                {name}
            </Typography>
            <Typography sx={{ flexGrow: 1, pr: 2 }}
                        variant="body2"
                        component="span"
                        color="text.secondary">
                This property can only be edited in code
            </Typography>
        </Box>
    );
}

function isValidDrag(tree: TreeData, source: TreeSourcePosition, destination: TreeDestinationPosition) {
    const draggedPropertyId = tree.items[source.parentId].children[source.index];
    const draggedProperty = tree.items[draggedPropertyId].data.property;
    if (typeof draggedProperty === "function")
        return false;
    if (destination.index === undefined)
        return false;
    if (destination.parentId === tree.rootId)
        return true;
    const destinationPropertyId = tree.items[destination.parentId].id;
    const destinationProperty: Property = tree.items[destinationPropertyId].data.property;
    return typeof destinationProperty === "object" && destinationProperty.dataType === "map";
}
